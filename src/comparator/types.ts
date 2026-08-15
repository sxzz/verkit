import type { SemVer, VersionOptions } from '../version/types.ts'

export interface RangeOptions extends VersionOptions {
  includePrerelease?: boolean
}

export interface SemVerComparator {
  operator: '' | '<' | '<=' | '>' | '>='
  options: RangeOptions
  value: string
  version: SemVer | null
}

export type ComparatorInput = SemVerComparator | string
