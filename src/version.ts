import { TRUNCATION_TYPES } from './constants.ts'
import {
  coerceParsedVersion,
  compareMainParsed,
  compareParsed,
  formatComparableVersion,
  formatFullVersion,
  incrementParsedVersion,
  parse,
  tryParse,
} from './internal/version.ts'
import type {
  CoerceOptions,
  IncrementOptions,
  IncrementType,
  PrereleaseIdentifier,
  TruncationType,
  VersionDifference,
  VersionInput,
  VersionOptions,
} from './types.ts'

export { parse, tryParse }

export function isValid(
  version: VersionInput,
  options: VersionOptions = {},
): boolean {
  return tryParse(version, options) !== null
}

export function normalizeFull(
  version: VersionInput,
  options: VersionOptions = {},
): string | null {
  const parsed = tryParse(version, options)
  return parsed ? formatFullVersion(parsed) : null
}

export function normalize(
  version: VersionInput,
  options: VersionOptions = {},
): string | null {
  const parsed = tryParse(version, options)
  return parsed ? formatComparableVersion(parsed) : null
}

export function clean(
  version: VersionInput,
  options: VersionOptions = {},
): string | null {
  if (typeof version !== 'string') {
    return normalize(version, options)
  }
  return normalize(version.trim().replace(/^[=v]+/, ''), options)
}

export function coerce(
  value: number | VersionInput,
  options: CoerceOptions = {},
): string | null {
  const parsed = coerceParsedVersion(value, options)
  return parsed ? formatFullVersion(parsed) : null
}

export function increment(
  version: VersionInput,
  release: IncrementType,
  options: IncrementOptions = {},
): string | null {
  try {
    return incrementParsedVersion(
      parse(version, options),
      release,
      options.identifier,
      options.identifierBase,
      options.loose,
    )
  } catch {
    return null
  }
}

export function truncate(
  version: VersionInput,
  truncation: TruncationType,
  options: VersionOptions = {},
): string | null {
  if (!TRUNCATION_TYPES.includes(truncation)) return null
  const parsed = tryParse(version, options)
  if (!parsed) return null
  if (truncation.startsWith('pre')) return formatComparableVersion(parsed)

  return formatComparableVersion({
    major: parsed.major,
    minor: truncation === 'major' ? 0 : parsed.minor,
    patch: truncation === 'major' || truncation === 'minor' ? 0 : parsed.patch,
    prerelease: [],
  })
}

export function difference(
  left: VersionInput,
  right: VersionInput,
): VersionDifference | null {
  const leftVersion = parse(left)
  const rightVersion = parse(right)
  const comparison = compareParsed(leftVersion, rightVersion)
  if (comparison === 0) return null

  const high = comparison > 0 ? leftVersion : rightVersion
  const low = comparison > 0 ? rightVersion : leftVersion
  const highHasPrerelease = high.prerelease.length > 0
  const lowHasPrerelease = low.prerelease.length > 0
  if (lowHasPrerelease && !highHasPrerelease) {
    if (low.patch === 0 && low.minor === 0) return 'major'
    if (compareMainParsed(low, high) === 0) {
      return low.minor !== 0 && low.patch === 0 ? 'minor' : 'patch'
    }
  }

  const prefix = highHasPrerelease ? 'pre' : ''
  if (leftVersion.major !== rightVersion.major) {
    return `${prefix}major` as VersionDifference
  }
  if (leftVersion.minor !== rightVersion.minor) {
    return `${prefix}minor` as VersionDifference
  }
  if (leftVersion.patch !== rightVersion.patch) {
    return `${prefix}patch` as VersionDifference
  }
  return 'prerelease'
}

export function getMajor(
  version: VersionInput,
  options: VersionOptions = {},
): number {
  return parse(version, options).major
}

export function getMinor(
  version: VersionInput,
  options: VersionOptions = {},
): number {
  return parse(version, options).minor
}

export function getPatch(
  version: VersionInput,
  options: VersionOptions = {},
): number {
  return parse(version, options).patch
}

export function getPrerelease(
  version: VersionInput,
  options: VersionOptions = {},
): PrereleaseIdentifier[] | null {
  const parsed = tryParse(version, options)
  return parsed?.prerelease.length ? [...parsed.prerelease] : null
}

export function getBuild(
  version: VersionInput,
  options: VersionOptions = {},
): string[] | null {
  const parsed = tryParse(version, options)
  return parsed ? [...parsed.build] : null
}
