import { formatComparator, parseComparator } from '../comparator/parse.ts'
import { compareParsed, sort } from '../version/comparison.ts'
import { formatComparableVersion, parse, tryParse } from '../version/parse.ts'
import {
  formatRange,
  parsedRangesIntersect,
  parseRange,
  testParsedRange,
  testRangeVersion,
  tryParseRange,
  type ParseRangeInput,
} from './parse.ts'
import type { RangeOptions } from '../comparator/types.ts'
import type { SemVer, VersionInput } from '../version/types.ts'
import type { RangeDirection, RangeInput, SemVerRange } from './types.ts'

type TryParseRangeInput = (
  range: RangeInput,
  options?: RangeOptions,
) => SemVerRange | null

type IsOutsideRangeInput = (
  version: VersionInput,
  range: RangeInput,
  direction: RangeDirection,
  options?: RangeOptions,
) => boolean

export function isValidRange(range: string, options?: RangeOptions): boolean
export function isValidRange(range: RangeInput): boolean
export function isValidRange(
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  return (tryParseRange as TryParseRangeInput)(range, options) !== null
}

export function normalizeRange(
  range: string,
  options?: RangeOptions,
): string | null
export function normalizeRange(range: RangeInput): string | null
export function normalizeRange(
  range: RangeInput,
  options: RangeOptions = {},
): string | null {
  const parsed = (tryParseRange as TryParseRangeInput)(range, options)
  return parsed ? formatRange(parsed) || '*' : null
}

export function satisfies(
  version: VersionInput,
  range: string,
  options?: RangeOptions,
): boolean
export function satisfies(version: VersionInput, range: RangeInput): boolean
export function satisfies(
  version: VersionInput,
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  const parsed = (tryParseRange as TryParseRangeInput)(range, options)
  return parsed ? testRangeVersion(parsed, version) : false
}

export function rangeToComparators(
  range: string,
  options?: RangeOptions,
): string[][]
export function rangeToComparators(range: RangeInput): string[][]
export function rangeToComparators(
  range: RangeInput,
  options: RangeOptions = {},
): string[][] {
  return (parseRange as ParseRangeInput)(range, options).sets.map((set) =>
    set.map(formatComparator).join(' ').trim().split(' '),
  )
}

export function findMaxSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: string,
  options?: RangeOptions,
): T | null
export function findMaxSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
): T | null
export function findMaxSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
  options: RangeOptions = {},
): T | null {
  const parsedRange = (tryParseRange as TryParseRangeInput)(range, options)
  if (!parsedRange) return null
  let maximum: T | null = null
  let maximumParsed: SemVer | null = null
  for (const version of versions) {
    const parsedVersion = tryParse(version, parsedRange.options)
    if (!parsedVersion || !testParsedRange(parsedRange, parsedVersion)) continue
    if (!maximumParsed || compareParsed(maximumParsed, parsedVersion) < 0) {
      maximum = version
      maximumParsed = parsedVersion
    }
  }
  return maximum
}

export function findMinSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: string,
  options?: RangeOptions,
): T | null
export function findMinSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
): T | null
export function findMinSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
  options: RangeOptions = {},
): T | null {
  const parsedRange = (tryParseRange as TryParseRangeInput)(range, options)
  if (!parsedRange) return null
  let minimum: T | null = null
  let minimumParsed: SemVer | null = null
  for (const version of versions) {
    const parsedVersion = tryParse(version, parsedRange.options)
    if (!parsedVersion || !testParsedRange(parsedRange, parsedVersion)) continue
    if (!minimumParsed || compareParsed(minimumParsed, parsedVersion) > 0) {
      minimum = version
      minimumParsed = parsedVersion
    }
  }
  return minimum
}

function nextVersionAfter(version: SemVer): SemVer {
  const { prerelease } = version
  return prerelease?.length
    ? {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        prerelease: [...prerelease, 0],
      }
    : {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
      }
}

export function findMinimumForRange(
  range: string,
  options?: RangeOptions,
): SemVer | null
export function findMinimumForRange(range: RangeInput): SemVer | null
export function findMinimumForRange(
  range: RangeInput,
  options: RangeOptions = {},
): SemVer | null {
  const parsedRange = (parseRange as ParseRangeInput)(range, options)
  const zero: SemVer = { major: 0, minor: 0, patch: 0 }
  if (testParsedRange(parsedRange, zero)) return zero
  const zeroPrerelease: SemVer = { ...zero, prerelease: [0] }
  if (testParsedRange(parsedRange, zeroPrerelease)) return zeroPrerelease

  let minimum: SemVer | null = null
  for (const set of parsedRange.sets) {
    let setMinimum: SemVer | null = null
    for (const comparator of set) {
      if (!comparator.version) continue
      const candidate =
        comparator.operator === '>'
          ? nextVersionAfter(comparator.version)
          : comparator.operator === '' || comparator.operator === '>='
            ? structuredClone(comparator.version)
            : null
      if (
        candidate &&
        (!setMinimum || compareParsed(candidate, setMinimum) > 0)
      ) {
        setMinimum = candidate
      }
    }
    if (setMinimum && (!minimum || compareParsed(minimum, setMinimum) > 0)) {
      minimum = setMinimum
    }
  }
  return minimum && testParsedRange(parsedRange, minimum) ? minimum : null
}

function compareInDirection(
  left: SemVer,
  right: SemVer,
  direction: RangeDirection,
): boolean {
  const comparison = compareParsed(left, right)
  return direction === '>' ? comparison > 0 : comparison < 0
}

function compareOppositeOrEqual(
  left: SemVer,
  right: SemVer,
  direction: RangeDirection,
): boolean {
  const comparison = compareParsed(left, right)
  return direction === '>' ? comparison <= 0 : comparison >= 0
}

function compareOpposite(
  left: SemVer,
  right: SemVer,
  direction: RangeDirection,
): boolean {
  const comparison = compareParsed(left, right)
  return direction === '>' ? comparison < 0 : comparison > 0
}

export function isOutsideRange(
  version: VersionInput,
  range: string,
  direction: RangeDirection,
  options?: RangeOptions,
): boolean
export function isOutsideRange(
  version: VersionInput,
  range: RangeInput,
  direction: RangeDirection,
): boolean
export function isOutsideRange(
  version: VersionInput,
  range: RangeInput,
  direction: RangeDirection,
  options: RangeOptions = {},
): boolean {
  if (direction !== '>' && direction !== '<') {
    throw new TypeError('Must provide a direction of "<" or ">"')
  }
  const parsedRange = (parseRange as ParseRangeInput)(range, options)
  const parsedVersion = parse(version, parsedRange.options)
  if (testParsedRange(parsedRange, parsedVersion)) return false

  const inclusiveDirection = direction === '>' ? '>=' : '<='
  for (const set of parsedRange.sets) {
    const concrete = set.map((comparator) =>
      comparator.version ? comparator : parseComparator('>=0.0.0'),
    )
    let high = concrete[0]!
    let low = concrete[0]!
    for (const comparator of concrete) {
      if (compareInDirection(comparator.version!, high.version!, direction)) {
        high = comparator
      } else if (
        compareOpposite(comparator.version!, low.version!, direction)
      ) {
        low = comparator
      }
    }

    if (high.operator === direction || high.operator === inclusiveDirection) {
      return false
    }
    if (
      (!low.operator || low.operator === direction) &&
      compareOppositeOrEqual(parsedVersion, low.version!, direction)
    ) {
      return false
    }
    if (
      low.operator === inclusiveDirection &&
      compareOpposite(parsedVersion, low.version!, direction)
    ) {
      return false
    }
  }
  return true
}

export function isGreaterThanRange(
  version: VersionInput,
  range: string,
  options?: RangeOptions,
): boolean
export function isGreaterThanRange(
  version: VersionInput,
  range: RangeInput,
): boolean
export function isGreaterThanRange(
  version: VersionInput,
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  return (isOutsideRange as IsOutsideRangeInput)(version, range, '>', options)
}

export function isLessThanRange(
  version: VersionInput,
  range: string,
  options?: RangeOptions,
): boolean
export function isLessThanRange(
  version: VersionInput,
  range: RangeInput,
): boolean
export function isLessThanRange(
  version: VersionInput,
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  return (isOutsideRange as IsOutsideRangeInput)(version, range, '<', options)
}

export function rangesIntersect(
  left: string,
  right: string,
  options?: RangeOptions,
): boolean
export function rangesIntersect(left: RangeInput, right: RangeInput): boolean
export function rangesIntersect(
  left: RangeInput,
  right: RangeInput,
  options: RangeOptions = {},
): boolean {
  const parsedLeft = (parseRange as ParseRangeInput)(left, options)
  const parsedRight = (parseRange as ParseRangeInput)(right, options)
  return parsedRangesIntersect(parsedLeft, parsedRight, {
    ...parsedLeft.options,
    ...parsedRight.options,
    ...options,
  })
}

export function simplifyRange<T extends VersionInput>(
  versions: readonly T[],
  range: string,
  options?: RangeOptions,
): string
export function simplifyRange<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
): string
export function simplifyRange<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
  options: RangeOptions = {},
): string {
  const parsedRange = (parseRange as ParseRangeInput)(range, options)
  const sorted = sort(versions, parsedRange.options)
  const sets: [T, T | null][] = []
  let first: T | null = null
  let previous: T | null = null
  for (const version of sorted) {
    if (testRangeVersion(parsedRange, version)) {
      previous = version
      first ??= version
    } else if (previous) {
      sets.push([first!, previous])
      first = null
      previous = null
    }
  }
  if (first) sets.push([first, null])

  const simplified = sets
    .map(([minimum, maximum]) => {
      const minimumValue = formatComparableVersion(
        parse(minimum, parsedRange.options),
      )
      const maximumValue = maximum
        ? formatComparableVersion(parse(maximum, parsedRange.options))
        : null
      if (minimumValue === maximumValue) return minimumValue
      if (!maximum && minimum === sorted[0]) return '*'
      if (!maximumValue) return `>=${minimumValue}`
      if (minimum === sorted[0]) return `<=${maximumValue}`
      return `${minimumValue} - ${maximumValue}`
    })
    .join(' || ')
  const original =
    typeof range === 'string' ? range : formatRange(parsedRange) || '*'
  return simplified.length < original.length ? simplified : original
}
