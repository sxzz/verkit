import { compareParsed } from '../version/comparison.ts'
import { tryParse } from '../version/parse.ts'
import { formatComparator } from './parse.ts'
import type { SemVer, VersionInput } from '../version/types.ts'
import type { RangeOptions, SemVerComparator } from './types.ts'

export function testParsedComparator(
  comparator: SemVerComparator,
  version: SemVer,
): boolean {
  if (!comparator.version) return true
  const comparison = compareParsed(version, comparator.version)
  switch (comparator.operator) {
    case '':
      return comparison === 0
    case '>':
      return comparison > 0
    case '>=':
      return comparison >= 0
    case '<':
      return comparison < 0
    case '<=':
      return comparison <= 0
  }
}

export function testComparatorVersion(
  comparator: SemVerComparator,
  version: VersionInput,
): boolean {
  const parsed = tryParse(version, comparator.options)
  return parsed ? testParsedComparator(comparator, parsed) : false
}

export function comparatorAllowsPrerelease(
  comparator: SemVerComparator,
  version: SemVer,
): boolean {
  const allowed = comparator.version
  return (
    allowed !== null &&
    !!allowed.prerelease?.length &&
    allowed.major === version.major &&
    allowed.minor === version.minor &&
    allowed.patch === version.patch
  )
}

export function testComparatorSet(
  set: readonly SemVerComparator[],
  version: SemVer,
  options: RangeOptions,
): boolean {
  if (set.some((comparator) => !testParsedComparator(comparator, version))) {
    return false
  }
  return (
    !version.prerelease?.length ||
    !!options.includePrerelease ||
    set.some((comparator) => comparatorAllowsPrerelease(comparator, version))
  )
}

export function parsedComparatorsIntersect(
  left: SemVerComparator,
  right: SemVerComparator,
  options: RangeOptions = {},
): boolean {
  if (!left.version || !right.version) return true
  // An exact-version comparator admits one version, so the other side must be
  // tested as a set to apply the prerelease rule.
  if (left.operator === '') {
    return testComparatorSet([right], left.version, options)
  }
  if (right.operator === '') {
    return testComparatorSet([left], right.version, options)
  }

  const leftValue = formatComparator(left)
  const rightValue = formatComparator(right)
  if (
    options.includePrerelease &&
    (leftValue === '<0.0.0-0' || rightValue === '<0.0.0-0')
  ) {
    return false
  }
  if (
    !options.includePrerelease &&
    (leftValue.startsWith('<0.0.0') || rightValue.startsWith('<0.0.0'))
  ) {
    return false
  }
  if (left.operator.startsWith('>') && right.operator.startsWith('>')) {
    return true
  }
  if (left.operator.startsWith('<') && right.operator.startsWith('<')) {
    return true
  }

  const comparison = compareParsed(left.version, right.version)
  if (
    comparison === 0 &&
    left.operator.includes('=') &&
    right.operator.includes('=')
  ) {
    return true
  }
  if (
    comparison < 0 &&
    left.operator.startsWith('>') &&
    right.operator.startsWith('<')
  ) {
    return true
  }
  return (
    comparison > 0 &&
    left.operator.startsWith('<') &&
    right.operator.startsWith('>')
  )
}
