import { sort } from './comparison.ts'
import { parseComparator, testParsedComparator } from './internal/comparator.ts'
import {
  parsedRangesIntersect,
  parseRange,
  testParsedRange,
  testRangeVersion,
  tryParseRange,
  type RangeInput,
} from './internal/range.ts'
import {
  compareParsed,
  formatComparableVersion,
  parse,
  tryParse,
} from './internal/version.ts'
import type {
  RangeDirection,
  RangeOptions,
  SemVer,
  SemVerComparator,
  VersionInput,
} from './types.ts'

export { parseRange, tryParseRange }
export type { RangeInput, SemVerRange } from './internal/range.ts'

export function isValidRange(
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  return tryParseRange(range, options) !== null
}

export function normalizeRange(
  range: RangeInput,
  options: RangeOptions = {},
): string | null {
  const parsed = tryParseRange(range, options)
  return parsed ? parsed.normalized || '*' : null
}

export function satisfies(
  version: VersionInput,
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  const parsed = tryParseRange(range, options)
  return parsed ? testRangeVersion(parsed, version) : false
}

export function rangeToComparators(
  range: RangeInput,
  options: RangeOptions = {},
): string[][] {
  return parseRange(range, options).sets.map((set) =>
    set
      .map((comparator) => comparator.value)
      .join(' ')
      .trim()
      .split(' '),
  )
}

export function findMaxSatisfying<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
  options: RangeOptions = {},
): T | null {
  const parsedRange = tryParseRange(range, options)
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
  range: RangeInput,
  options: RangeOptions = {},
): T | null {
  const parsedRange = tryParseRange(range, options)
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
  const comparable = formatComparableVersion(
    prerelease?.length
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
        },
  )
  return parse(comparable)
}

export function findMinimumForRange(
  range: RangeInput,
  options: RangeOptions = {},
): string | null {
  const parsedRange = parseRange(range, options)
  const zero = parse('0.0.0')
  if (testParsedRange(parsedRange, zero)) return formatComparableVersion(zero)
  const zeroPrerelease = parse('0.0.0-0')
  if (testParsedRange(parsedRange, zeroPrerelease)) {
    return formatComparableVersion(zeroPrerelease)
  }

  let minimum: SemVer | null = null
  for (const set of parsedRange.sets) {
    let setMinimum: SemVer | null = null
    for (const comparator of set) {
      if (!comparator.version) continue
      const candidate =
        comparator.operator === '>'
          ? nextVersionAfter(comparator.version)
          : comparator.operator === '' || comparator.operator === '>='
            ? comparator.version
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
  return minimum && testParsedRange(parsedRange, minimum)
    ? formatComparableVersion(minimum)
    : null
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
  range: RangeInput,
  direction: RangeDirection,
  options: RangeOptions = {},
): boolean {
  if (direction !== '>' && direction !== '<') {
    throw new TypeError('Must provide a direction of "<" or ">"')
  }
  const parsedRange = parseRange(range, options)
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
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  return isOutsideRange(version, range, '>', options)
}

export function isLessThanRange(
  version: VersionInput,
  range: RangeInput,
  options: RangeOptions = {},
): boolean {
  return isOutsideRange(version, range, '<', options)
}

export function rangesIntersect(
  left: RangeInput,
  right: RangeInput,
  options: RangeOptions = {},
): boolean {
  const parsedLeft = parseRange(left, options)
  const parsedRight = parseRange(right, options)
  return parsedRangesIntersect(parsedLeft, parsedRight, {
    ...parsedLeft.options,
    ...parsedRight.options,
    ...options,
  })
}

export function simplifyRange<T extends VersionInput>(
  versions: readonly T[],
  range: RangeInput,
  options: RangeOptions = {},
): string {
  const parsedRange = parseRange(range, options)
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
  const original = typeof range === 'string' ? range : range.raw
  return simplified.length < original.length ? simplified : original
}

function higherLowerBound(
  left: SemVerComparator | undefined,
  right: SemVerComparator,
): SemVerComparator {
  if (!left) return right
  const comparison = compareParsed(left.version!, right.version!)
  return comparison > 0
    ? left
    : comparison < 0 || (right.operator === '>' && left.operator === '>=')
      ? right
      : left
}

function lowerUpperBound(
  left: SemVerComparator | undefined,
  right: SemVerComparator,
): SemVerComparator {
  if (!left) return right
  const comparison = compareParsed(left.version!, right.version!)
  return comparison < 0
    ? left
    : comparison > 0 || (right.operator === '<' && left.operator === '<=')
      ? right
      : left
}

function samePrereleaseTuple(
  comparator: SemVerComparator,
  version: SemVer,
): boolean {
  const candidate = comparator.version
  return (
    candidate !== null &&
    !!candidate.prerelease?.length &&
    candidate.major === version.major &&
    candidate.minor === version.minor &&
    candidate.patch === version.patch
  )
}

function simpleRangeSubset(
  rawSubset: readonly SemVerComparator[],
  rawSuperset: readonly SemVerComparator[],
  options: RangeOptions,
): boolean | null {
  let subset = rawSubset
  let superset = rawSuperset
  const subsetAny = subset.length === 1 && !subset[0]!.version
  const supersetAny = superset.length === 1 && !superset[0]!.version
  if (subsetAny) {
    if (supersetAny) return true
    subset = [
      parseComparator(options.includePrerelease ? '>=0.0.0-0' : '>=0.0.0'),
    ]
  }
  if (supersetAny) {
    if (options.includePrerelease) return true
    superset = [parseComparator('>=0.0.0')]
  }

  const equal = new Map<string, SemVer>()
  let lower: SemVerComparator | undefined
  let upper: SemVerComparator | undefined
  for (const comparator of subset) {
    if (comparator.operator === '>' || comparator.operator === '>=') {
      lower = higherLowerBound(lower, comparator)
    } else if (comparator.operator === '<' || comparator.operator === '<=') {
      upper = lowerUpperBound(upper, comparator)
    } else if (comparator.version) {
      equal.set(formatComparableVersion(comparator.version), comparator.version)
    }
  }
  if (equal.size > 1) return null

  let boundsComparison: number | undefined
  if (lower && upper) {
    boundsComparison = compareParsed(lower.version!, upper.version!)
    if (boundsComparison > 0) return null
    if (
      boundsComparison === 0 &&
      (lower.operator !== '>=' || upper.operator !== '<=')
    ) {
      return null
    }
  }

  for (const version of equal.values()) {
    if (lower && !testParsedComparator(lower, version)) return null
    if (upper && !testParsedComparator(upper, version)) return null
    return superset.every((comparator) =>
      testParsedComparator(comparator, version),
    )
  }

  let needsLowerPrerelease =
    lower && !options.includePrerelease && lower.version!.prerelease?.length
      ? lower.version!
      : null
  let needsUpperPrerelease =
    upper && !options.includePrerelease && upper.version!.prerelease?.length
      ? upper.version!
      : null
  const upperPrerelease = needsUpperPrerelease?.prerelease
  if (
    upperPrerelease?.length === 1 &&
    upper?.operator === '<' &&
    upperPrerelease[0] === 0
  ) {
    needsUpperPrerelease = null
  }

  let hasSupersetLower = false
  let hasSupersetUpper = false
  for (const comparator of superset) {
    hasSupersetLower ||=
      comparator.operator === '>' || comparator.operator === '>='
    hasSupersetUpper ||=
      comparator.operator === '<' || comparator.operator === '<='
    if (lower) {
      if (
        needsLowerPrerelease &&
        samePrereleaseTuple(comparator, needsLowerPrerelease)
      ) {
        needsLowerPrerelease = null
      }
      if (comparator.operator === '>' || comparator.operator === '>=') {
        const higher = higherLowerBound(lower, comparator)
        if (higher === comparator && higher !== lower) return false
      } else if (
        lower.operator === '>=' &&
        !testParsedComparator(comparator, lower.version!)
      ) {
        return false
      }
    }
    if (upper) {
      if (
        needsUpperPrerelease &&
        samePrereleaseTuple(comparator, needsUpperPrerelease)
      ) {
        needsUpperPrerelease = null
      }
      if (comparator.operator === '<' || comparator.operator === '<=') {
        const lowerBound = lowerUpperBound(upper, comparator)
        if (lowerBound === comparator && lowerBound !== upper) return false
      } else if (
        upper.operator === '<=' &&
        !testParsedComparator(comparator, upper.version!)
      ) {
        return false
      }
    }
    if (
      comparator.operator === '' &&
      (lower || upper) &&
      boundsComparison !== 0
    ) {
      return false
    }
  }

  if (lower && hasSupersetUpper && !upper && boundsComparison !== 0)
    return false
  if (upper && hasSupersetLower && !lower && boundsComparison !== 0)
    return false
  return !needsLowerPrerelease && !needsUpperPrerelease
}

export function isRangeSubset(
  subset: RangeInput,
  superset: RangeInput,
  options: RangeOptions = {},
): boolean {
  if (subset === superset) return true
  const parsedSubset = parseRange(subset, options)
  const parsedSuperset = parseRange(superset, options)
  const effectiveOptions = {
    ...parsedSubset.options,
    ...parsedSuperset.options,
    ...options,
  }
  let sawNonNull = false

  for (const subsetSet of parsedSubset.sets) {
    let matched = false
    for (const supersetSet of parsedSuperset.sets) {
      const result = simpleRangeSubset(subsetSet, supersetSet, effectiveOptions)
      sawNonNull ||= result !== null
      if (result) {
        matched = true
        break
      }
    }
    if (!matched && sawNonNull) return false
  }
  return true
}
