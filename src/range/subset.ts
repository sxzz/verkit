import { parseComparator } from '../comparator/parse.ts'
import {
  comparatorAllowsPrerelease,
  testComparatorSet,
  testParsedComparator,
} from '../comparator/set.ts'
import { compareParsed } from '../version/comparison.ts'
import { formatComparableVersion } from '../version/parse.ts'
import { parseRange, type ParseRangeInput } from './parse.ts'
import type { RangeOptions, SemVerComparator } from '../comparator/types.ts'
import type { SemVer } from '../version/types.ts'
import type { RangeInput } from './types.ts'

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
    // Testing each superset comparator on its own would skip the prerelease rule.
    return testComparatorSet(superset, version, options)
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
        comparatorAllowsPrerelease(comparator, needsLowerPrerelease)
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
        comparatorAllowsPrerelease(comparator, needsUpperPrerelease)
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
  subset: string,
  superset: string,
  options?: RangeOptions,
): boolean
export function isRangeSubset(subset: RangeInput, superset: RangeInput): boolean
export function isRangeSubset(
  subset: RangeInput,
  superset: RangeInput,
  options: RangeOptions = {},
): boolean {
  if (subset === superset) return true
  const parsedSubset = (parseRange as ParseRangeInput)(subset, options)
  const parsedSuperset = (parseRange as ParseRangeInput)(superset, options)
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
