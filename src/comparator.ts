import {
  parseComparator,
  parsedComparatorsIntersect,
  testComparatorVersion,
} from './internal/comparator.ts'
import type { RangeOptions, VersionInput } from './types.ts'

export function normalizeComparator(
  comparator: string,
  options: RangeOptions = {},
): string {
  return parseComparator(comparator, options).value
}

export function satisfiesComparator(
  version: VersionInput,
  comparator: string,
  options: RangeOptions = {},
): boolean {
  return testComparatorVersion(parseComparator(comparator, options), version)
}

export function comparatorsIntersect(
  left: string,
  right: string,
  options: RangeOptions = {},
): boolean {
  return parsedComparatorsIntersect(
    parseComparator(left, options),
    parseComparator(right, options),
    options,
  )
}
