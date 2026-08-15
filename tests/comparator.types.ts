import {
  comparatorsIntersect,
  normalizeComparator,
  parseComparator,
  satisfiesComparator,
  tryParseComparator,
  type ComparatorInput,
  type RangeOptions,
  type SemVerComparator,
} from '../src/index.ts'

declare const input: ComparatorInput
declare const options: RangeOptions
declare const parsed: SemVerComparator

parseComparator(input)
tryParseComparator(input)
normalizeComparator(input)
satisfiesComparator('1.0.0', input)
comparatorsIntersect(input, parsed)

// @ts-expect-error A parsed comparator already contains its parsing options.
parseComparator(parsed, options)
// @ts-expect-error A parsed comparator already contains its parsing options.
tryParseComparator(parsed, options)
// @ts-expect-error A parsed comparator already contains its parsing options.
normalizeComparator(parsed, options)
// @ts-expect-error A parsed comparator already contains its parsing options.
satisfiesComparator('1.0.0', parsed, options)
// @ts-expect-error Parsed comparators already contain their parsing options.
comparatorsIntersect(parsed, '>=1.0.0', options)
