export interface VersionOptions {
  loose?: boolean
}

export interface RangeOptions extends VersionOptions {
  includePrerelease?: boolean
}

export interface CoerceOptions extends VersionOptions {
  includePrerelease?: boolean
  rtl?: boolean
}

export interface IncrementOptions extends VersionOptions {
  identifier?: string
  identifierBase?: 0 | 1 | false
}

export type PrereleaseIdentifier = number | string

export interface SemVer {
  build: string[]
  major: number
  minor: number
  patch: number
  prerelease: PrereleaseIdentifier[]
}

export interface SemVerComparator {
  operator: '' | '<' | '<=' | '>' | '>='
  options: RangeOptions
  value: string
  version: SemVer | null
}

export type VersionInput = SemVer | string

export type Comparison = -1 | 0 | 1

export type ComparisonOperator =
  '' | '!=' | '!==' | '<' | '<=' | '=' | '==' | '===' | '>' | '>='

export type RangeDirection = '<' | '>'

export type IncrementType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'premajor'
  | 'preminor'
  | 'prepatch'
  | 'prerelease'
  | 'release'

export type TruncationType = Exclude<IncrementType, 'release'>

export type VersionDifference =
  | 'major'
  | 'minor'
  | 'patch'
  | 'premajor'
  | 'preminor'
  | 'prepatch'
  | 'prerelease'
