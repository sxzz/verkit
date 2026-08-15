import type { RangeOptions, SemVerComparator } from '../comparator/types.ts'

export interface SemVerRange {
  options: RangeOptions
  sets: SemVerComparator[][]
}

export type RangeInput = SemVerRange | string

export type RangeDirection = '<' | '>'
