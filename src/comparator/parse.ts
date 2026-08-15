import { formatComparableVersion, parse } from '../version/parse.ts'
import {
  FULL_PLAIN,
  GREATER_LESS_THAN,
  LOOSE_PLAIN,
  safeRegex,
} from '../version/patterns.ts'
import type {
  ComparatorInput,
  RangeOptions,
  SemVerComparator,
} from './types.ts'

const STRICT_COMPARATOR = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*(${FULL_PLAIN})$|^$`,
)
const LOOSE_COMPARATOR = safeRegex(
  String.raw`^${GREATER_LESS_THAN}\s*(${LOOSE_PLAIN})$|^$`,
)

export function formatComparator(comparator: SemVerComparator): string {
  return comparator.version
    ? `${comparator.operator}${formatComparableVersion(comparator.version)}`
    : ''
}

export function parseComparator(
  comparator: string,
  options?: RangeOptions,
): SemVerComparator
export function parseComparator(comparator: ComparatorInput): SemVerComparator
export function parseComparator(
  comparator: ComparatorInput,
  options: RangeOptions = {},
): SemVerComparator {
  if (typeof comparator !== 'string') return comparator
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

export function tryParseComparator(
  comparator: string,
  options?: RangeOptions,
): SemVerComparator | null
export function tryParseComparator(
  comparator: ComparatorInput,
): SemVerComparator | null
export function tryParseComparator(
  comparator: ComparatorInput,
  options: RangeOptions = {},
): SemVerComparator | null {
  try {
    return typeof comparator === 'string'
      ? parseComparator(comparator, options)
      : comparator
  } catch {
    return null
  }
}
