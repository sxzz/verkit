import {
  FULL_PLAIN,
  GREATER_LESS_THAN,
  LOOSE_PLAIN,
  safeRegex,
} from './patterns.ts'
import {
  compareParsed,
  formatComparableVersion,
  parse,
  tryParse,
} from './version.ts'
import type {
  RangeOptions,
  SemVer,
  SemVerComparator,
  VersionInput,
} from '../types.ts'

const STRICT_COMPARATOR = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*(${FULL_PLAIN})$|^$`,
)
const LOOSE_COMPARATOR = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN})$|^$`,
)

export function parseComparator(
  comparator: string,
  options: RangeOptions = {},
): SemVerComparator {
  const normalized = comparator.trim().replaceAll(/\s+/g, ' ')
  const match = normalized.match(
    options.loose ? LOOSE_COMPARATOR : STRICT_COMPARATOR,
  )
  if (!match) throw new TypeError(`Invalid comparator: ${normalized}`)

  const operator = (
    match[1] === '=' ? '' : match[1] || ''
  ) as SemVerComparator['operator']
  const version = match[2] ? parse(match[2], options) : null
  return {
    operator,
    options,
    value: version ? `${operator}${formatComparableVersion(version)}` : '',
    version,
  }
}

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

export function parsedComparatorsIntersect(
  left: SemVerComparator,
  right: SemVerComparator,
  options: RangeOptions = {},
): boolean {
  if (!left.version || !right.version) return true
  if (left.operator === '') return testParsedComparator(right, left.version)
  if (right.operator === '') return testParsedComparator(left, right.version)

  if (
    options.includePrerelease &&
    (left.value === '<0.0.0-0' || right.value === '<0.0.0-0')
  ) {
    return false
  }
  if (
    !options.includePrerelease &&
    (left.value.startsWith('<0.0.0') || right.value.startsWith('<0.0.0'))
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
