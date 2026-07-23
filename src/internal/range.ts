import {
  parseComparator,
  parsedComparatorsIntersect,
  testParsedComparator,
} from './comparator.ts'
import {
  BUILD,
  GREATER_LESS_THAN,
  LONE_CARET,
  LONE_TILDE,
  LOOSE_PLAIN,
  safeRegex,
  XRANGE_PLAIN,
  XRANGE_PLAIN_LOOSE,
} from './range-patterns.ts'
import { tryParse } from './version.ts'
import type {
  RangeOptions,
  SemVer,
  SemVerComparator,
  VersionInput,
} from '../types.ts'

export interface SemVerRange {
  normalized: string
  options: RangeOptions
  raw: string
  sets: SemVerComparator[][]
}

export type RangeInput = SemVerRange | string

const BUILD_STRIP = new RegExp(BUILD, 'g')
const BUILD_SAFE = safeRegex(BUILD)
const STRICT_HYPHEN = safeRegex(
  String.raw`^\s*(${XRANGE_PLAIN})\s+-\s+(${XRANGE_PLAIN})\s*$`,
)
const LOOSE_HYPHEN = safeRegex(
  String.raw`^\s*(${XRANGE_PLAIN_LOOSE})\s+-\s+(${XRANGE_PLAIN_LOOSE})\s*$`,
)
const COMPARATOR_TRIM = safeRegex(
  String.raw`(\s*)${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN}|${XRANGE_PLAIN})`,
  'g',
)
const TILDE_TRIM = safeRegex(String.raw`(\s*)${LONE_TILDE}\s+`, 'g')
const CARET_TRIM = safeRegex(String.raw`(\s*)${LONE_CARET}\s+`, 'g')
const STRICT_TILDE = safeRegex(`^${LONE_TILDE}${XRANGE_PLAIN}$`)
const LOOSE_TILDE = safeRegex(`^${LONE_TILDE}${XRANGE_PLAIN_LOOSE}$`)
const STRICT_CARET = safeRegex(`^${LONE_CARET}${XRANGE_PLAIN}$`)
const LOOSE_CARET = safeRegex(`^${LONE_CARET}${XRANGE_PLAIN_LOOSE}$`)
const STRICT_XRANGE = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*${XRANGE_PLAIN}$`,
)
const LOOSE_XRANGE = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*${XRANGE_PLAIN_LOOSE}$`,
)
const STAR = safeRegex(String.raw`(<|>)?=?\s*\*`)
const GTE_ZERO = /^\s*>=\s*0\.0\.0\s*$/
const GTE_ZERO_PRERELEASE = /^\s*>=\s*0\.0\.0-0\s*$/
const LOOSE_COMPARATOR = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN})$|^$`,
)

function isWildcard(value: unknown): boolean {
  return !value || String(value).toLowerCase() === 'x' || String(value) === '*'
}

function hasInvalidWildcardOrder(
  major: string | undefined,
  minor: string | undefined,
  patch: string | undefined,
): boolean {
  return (
    (isWildcard(major) && !isWildcard(minor)) ||
    (isWildcard(minor) && Boolean(patch) && !isWildcard(patch))
  )
}

function replaceTilde(comparator: string, options: RangeOptions): string {
  const expression = options.loose ? LOOSE_TILDE : STRICT_TILDE
  const lowerPrerelease = options.includePrerelease ? '-0' : ''
  return comparator.replace(
    expression,
    (_match, major, minor, patch, prerelease) => {
      if (isWildcard(major)) return ''
      if (isWildcard(minor)) {
        return `>=${major}.0.0${lowerPrerelease} <${Number(major) + 1}.0.0-0`
      }
      if (isWildcard(patch)) {
        return `>=${major}.${minor}.0${lowerPrerelease} <${major}.${Number(minor) + 1}.0-0`
      }
      return prerelease
        ? `>=${major}.${minor}.${patch}-${prerelease} <${major}.${Number(minor) + 1}.0-0`
        : `>=${major}.${minor}.${patch} <${major}.${Number(minor) + 1}.0-0`
    },
  )
}

function replaceTildes(comparator: string, options: RangeOptions): string {
  return comparator
    .trim()
    .split(/\s+/)
    .map((part) => replaceTilde(part, options))
    .join(' ')
}

function replaceCaret(comparator: string, options: RangeOptions): string {
  const expression = options.loose ? LOOSE_CARET : STRICT_CARET
  const lowerPrerelease = options.includePrerelease ? '-0' : ''
  return comparator.replace(
    expression,
    (_match, major, minor, patch, prerelease) => {
      if (isWildcard(major)) return ''
      if (isWildcard(minor)) {
        return `>=${major}.0.0${lowerPrerelease} <${Number(major) + 1}.0.0-0`
      }
      if (isWildcard(patch)) {
        return major === '0'
          ? `>=${major}.${minor}.0${lowerPrerelease} <${major}.${Number(minor) + 1}.0-0`
          : `>=${major}.${minor}.0${lowerPrerelease} <${Number(major) + 1}.0.0-0`
      }
      if (prerelease) {
        return major === '0'
          ? minor === '0'
            ? `>=${major}.${minor}.${patch}-${prerelease} <${major}.${minor}.${Number(patch) + 1}-0`
            : `>=${major}.${minor}.${patch}-${prerelease} <${major}.${Number(minor) + 1}.0-0`
          : `>=${major}.${minor}.${patch}-${prerelease} <${Number(major) + 1}.0.0-0`
      }
      return major === '0'
        ? minor === '0'
          ? `>=${major}.${minor}.${patch} <${major}.${minor}.${Number(patch) + 1}-0`
          : `>=${major}.${minor}.${patch} <${major}.${Number(minor) + 1}.0-0`
        : `>=${major}.${minor}.${patch} <${Number(major) + 1}.0.0-0`
    },
  )
}

function replaceCarets(comparator: string, options: RangeOptions): string {
  return comparator
    .trim()
    .split(/\s+/)
    .map((part) => replaceCaret(part, options))
    .join(' ')
}

function replaceXRange(comparator: string, options: RangeOptions): string {
  const expression = options.loose ? LOOSE_XRANGE : STRICT_XRANGE
  return comparator
    .trim()
    .replace(expression, (match, rawOperator, rawMajor, rawMinor, rawPatch) => {
      let operator = rawOperator as string
      let major = rawMajor as number | string
      let minor = rawMinor as number | string
      let patch = rawPatch as number | string
      if (
        hasInvalidWildcardOrder(
          String(major),
          minor === undefined ? undefined : String(minor),
          patch === undefined ? undefined : String(patch),
        )
      ) {
        return comparator
      }

      const wildcardMajor = isWildcard(major)
      const wildcardMinor = wildcardMajor || isWildcard(minor)
      const wildcardPatch = wildcardMinor || isWildcard(patch)
      if (operator === '=' && wildcardPatch) operator = ''
      if (wildcardMajor) {
        return operator === '>' || operator === '<' ? '<0.0.0-0' : '*'
      }

      let prerelease = options.includePrerelease ? '-0' : ''
      if (operator && wildcardPatch) {
        if (wildcardMinor) minor = 0
        patch = 0
        if (operator === '>') {
          operator = '>='
          if (wildcardMinor) {
            major = Number(major) + 1
            minor = 0
          } else {
            minor = Number(minor) + 1
          }
        } else if (operator === '<=') {
          operator = '<'
          if (wildcardMinor) major = Number(major) + 1
          else minor = Number(minor) + 1
        }
        if (operator === '<') prerelease = '-0'
        return `${operator}${major}.${minor}.${patch}${prerelease}`
      }
      if (wildcardMinor) {
        return `>=${major}.0.0${prerelease} <${Number(major) + 1}.0.0-0`
      }
      if (wildcardPatch) {
        return `>=${major}.${minor}.0${prerelease} <${major}.${Number(minor) + 1}.0-0`
      }
      return match
    })
}

function replaceXRanges(comparator: string, options: RangeOptions): string {
  return comparator
    .split(/\s+/)
    .map((part) => replaceXRange(part, options))
    .join(' ')
}

function replaceHyphenRange(range: string, options: RangeOptions): string {
  const expression = options.loose ? LOOSE_HYPHEN : STRICT_HYPHEN
  return range.replace(
    expression,
    (
      _match,
      rawFrom,
      fromMajor,
      fromMinor,
      fromPatch,
      fromPrerelease,
      _fromBuild,
      rawTo,
      toMajor,
      toMinor,
      toPatch,
      toPrerelease,
    ) => {
      let from = rawFrom as string
      let to = rawTo as string
      if (isWildcard(fromMajor)) from = ''
      else if (isWildcard(fromMinor)) {
        from = `>=${fromMajor}.0.0${options.includePrerelease ? '-0' : ''}`
      } else if (isWildcard(fromPatch)) {
        from = `>=${fromMajor}.${fromMinor}.0${options.includePrerelease ? '-0' : ''}`
      } else if (fromPrerelease) from = `>=${from}`
      else from = `>=${from}${options.includePrerelease ? '-0' : ''}`

      if (isWildcard(toMajor)) to = ''
      else if (isWildcard(toMinor)) to = `<${Number(toMajor) + 1}.0.0-0`
      else if (isWildcard(toPatch)) {
        to = `<${toMajor}.${Number(toMinor) + 1}.0-0`
      } else if (toPrerelease) {
        to = `<=${toMajor}.${toMinor}.${toPatch}-${toPrerelease}`
      } else if (options.includePrerelease) {
        to = `<${toMajor}.${toMinor}.${Number(toPatch) + 1}-0`
      } else to = `<=${to}`
      return `${from} ${to}`.trim()
    },
  )
}

function expandComparator(comparator: string, options: RangeOptions): string {
  return replaceXRanges(
    replaceTildes(
      replaceCarets(comparator.replace(BUILD_SAFE, ''), options),
      options,
    ),
    options,
  )
    .trim()
    .replace(STAR, '')
}

function parseSimpleRange(
  input: string,
  options: RangeOptions,
): SemVerComparator[] {
  const range = input.replace(BUILD_STRIP, '')
  const expanded = replaceHyphenRange(range, options)
    .replace(COMPARATOR_TRIM, '$1$2$3')
    .replace(TILDE_TRIM, '$1~')
    .replace(CARET_TRIM, '$1^')
  let parts = expanded
    .split(' ')
    .map((part) => expandComparator(part, options))
    .join(' ')
    .split(/\s+/)
    .map((part) =>
      part
        .trim()
        .replace(
          options.includePrerelease ? GTE_ZERO_PRERELEASE : GTE_ZERO,
          '',
        ),
    )

  if (options.loose) {
    parts = parts.filter((part) => LOOSE_COMPARATOR.test(part))
  }
  const unique = new Map<string, SemVerComparator>()
  for (const comparator of parts.map((part) =>
    parseComparator(part, options),
  )) {
    if (comparator.value === '<0.0.0-0') {
      return [comparator]
    }
    unique.set(comparator.value, comparator)
  }
  if (unique.size > 1) unique.delete('')
  return [...unique.values()]
}

export function parseRange(
  range: RangeInput,
  options: RangeOptions = {},
): SemVerRange {
  if (typeof range !== 'string') return range
  const parsedOptions = { ...options }
  const raw = range.trim().replaceAll(/\s+/g, ' ')
  let sets = raw
    .split('||')
    .map((part) => parseSimpleRange(part.trim(), parsedOptions))
    .filter((set) => set.length)
  if (!sets.length) {
    throw new TypeError(`Range contains no valid comparator sets: ${raw}`)
  }

  if (sets.length > 1) {
    const first = sets[0]!
    sets = sets.filter((set) => set[0]?.value !== '<0.0.0-0')
    if (!sets.length) sets = [first]
    else if (sets.length > 1) {
      const any = sets.find((set) => set.length === 1 && set[0]?.value === '')
      if (any) sets = [any]
    }
  }

  return {
    normalized: sets
      .map((set) => set.map((comparator) => comparator.value).join(' '))
      .join('||'),
    options: parsedOptions,
    raw,
    sets,
  }
}

export function tryParseRange(
  range: RangeInput,
  options: RangeOptions = {},
): SemVerRange | null {
  try {
    return parseRange(range, options)
  } catch {
    return null
  }
}

export function testComparatorSet(
  set: readonly SemVerComparator[],
  version: SemVer,
  options: RangeOptions,
): boolean {
  if (set.some((comparator) => !testParsedComparator(comparator, version))) {
    return false
  }
  if (!version.prerelease?.length || options.includePrerelease) {
    return true
  }

  return set.some((comparator) => {
    const allowed = comparator.version
    return (
      allowed !== null &&
      allowed.prerelease?.length &&
      allowed.major === version.major &&
      allowed.minor === version.minor &&
      allowed.patch === version.patch
    )
  })
}

export function testParsedRange(range: SemVerRange, version: SemVer): boolean {
  return range.sets.some((set) =>
    testComparatorSet(set, version, range.options),
  )
}

export function testRangeVersion(
  range: SemVerRange,
  version: VersionInput,
): boolean {
  const parsed = tryParse(version, range.options)
  return parsed ? testParsedRange(range, parsed) : false
}

function isSatisfiable(
  comparators: readonly SemVerComparator[],
  options: RangeOptions,
): boolean {
  const remaining = [...comparators]
  let current = remaining.pop()
  while (current && remaining.length) {
    if (
      remaining.some(
        (other) => !parsedComparatorsIntersect(current!, other, options),
      )
    ) {
      return false
    }
    current = remaining.pop()
  }
  return true
}

export function parsedRangesIntersect(
  left: SemVerRange,
  right: SemVerRange,
  options: RangeOptions = {},
): boolean {
  return left.sets.some(
    (leftSet) =>
      isSatisfiable(leftSet, options) &&
      right.sets.some(
        (rightSet) =>
          isSatisfiable(rightSet, options) &&
          leftSet.every((leftComparator) =>
            rightSet.every((rightComparator) =>
              parsedComparatorsIntersect(
                leftComparator,
                rightComparator,
                options,
              ),
            ),
          ),
      ),
  )
}
