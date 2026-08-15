import { formatComparator, parseComparator } from './parse.ts'
import { parsedComparatorsIntersect, testComparatorVersion } from './set.ts'
import type { VersionInput } from '../version/types.ts'
import type {
  ComparatorInput,
  RangeOptions,
  SemVerComparator,
} from './types.ts'

function resolveComparator(
  comparator: ComparatorInput,
  options: RangeOptions,
): SemVerComparator {
  return typeof comparator === 'string'
    ? parseComparator(comparator, options)
    : comparator
}

export function normalizeComparator(
  comparator: string,
  options?: RangeOptions,
): string
export function normalizeComparator(comparator: ComparatorInput): string
export function normalizeComparator(
  comparator: ComparatorInput,
  options: RangeOptions = {},
): string {
  return formatComparator(resolveComparator(comparator, options))
}

export function satisfiesComparator(
  version: VersionInput,
  comparator: string,
  options?: RangeOptions,
): boolean
export function satisfiesComparator(
  version: VersionInput,
  comparator: ComparatorInput,
): boolean
export function satisfiesComparator(
  version: VersionInput,
  comparator: ComparatorInput,
  options: RangeOptions = {},
): boolean {
  return testComparatorVersion(resolveComparator(comparator, options), version)
}

export function comparatorsIntersect(
  left: string,
  right: string,
  options?: RangeOptions,
): boolean
export function comparatorsIntersect(
  left: ComparatorInput,
  right: ComparatorInput,
): boolean
export function comparatorsIntersect(
  left: ComparatorInput,
  right: ComparatorInput,
  options: RangeOptions = {},
): boolean {
  const parsedLeft = resolveComparator(left, options)
  const parsedRight = resolveComparator(right, options)
  return parsedComparatorsIntersect(parsedLeft, parsedRight, {
    ...parsedLeft.options,
    ...parsedRight.options,
    ...options,
  })
}
