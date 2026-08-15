import type { IncrementType, TruncationType } from './types.ts'

export const SEMVER_SPEC_VERSION: string = '2.0.0'

export const INCREMENT_TYPES: readonly IncrementType[] = [
  'major',
  'premajor',
  'minor',
  'preminor',
  'patch',
  'prepatch',
  'prerelease',
  'release',
]

export const TRUNCATION_TYPES: readonly TruncationType[] = [
  'major',
  'premajor',
  'minor',
  'preminor',
  'patch',
  'prepatch',
  'prerelease',
]

export const MAX_LENGTH: number = 256
export const MAX_SAFE_COMPONENT_LENGTH: number = 16
export const MAX_SAFE_BUILD_LENGTH: number = MAX_LENGTH - 6
