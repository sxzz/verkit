import { MAX_LENGTH } from './constants.ts'
import { FULL_PLAIN, LOOSE_PLAIN, safeRegex } from './patterns.ts'
import type {
  PrereleaseIdentifier,
  SemVer,
  VersionInput,
  VersionOptions,
} from './types.ts'

const FULL = safeRegex(`^${FULL_PLAIN}$`)
const LOOSE = safeRegex(`^${LOOSE_PLAIN}$`)
const NUMERIC = /^\d+$/

export function formatComparableVersion(
  version: Pick<SemVer, 'major' | 'minor' | 'patch' | 'prerelease'>,
): string {
  const base = `${version.major}.${version.minor}.${version.patch}`
  return version.prerelease?.length
    ? `${base}-${version.prerelease.join('.')}`
    : base
}

export function formatFullVersion(
  version: Pick<SemVer, 'build' | 'major' | 'minor' | 'patch' | 'prerelease'>,
): string {
  const comparable = formatComparableVersion(version)
  return version.build?.length
    ? `${comparable}+${version.build.join('.')}`
    : comparable
}

export function parse(
  version: VersionInput,
  options: VersionOptions = {},
): SemVer {
  if (typeof version !== 'string') return version

  if (version.length > MAX_LENGTH) {
    throw new TypeError(
      `Version exceeds the maximum length of ${MAX_LENGTH} characters`,
    )
  }

  const match = version.trim().match(options.loose ? LOOSE : FULL)
  if (!match) throw new TypeError(`Invalid version syntax: ${version}`)

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  if (major > Number.MAX_SAFE_INTEGER || major < 0) {
    throw new TypeError(`Invalid major version: ${match[1]}`)
  }
  if (minor > Number.MAX_SAFE_INTEGER || minor < 0) {
    throw new TypeError(`Invalid minor version: ${match[2]}`)
  }
  if (patch > Number.MAX_SAFE_INTEGER || patch < 0) {
    throw new TypeError(`Invalid patch version: ${match[3]}`)
  }

  const prerelease = match[4]
    ? match[4].split('.').map<PrereleaseIdentifier>((identifier) => {
        if (NUMERIC.test(identifier)) {
          const numeric = Number(identifier)
          if (numeric >= 0 && numeric < Number.MAX_SAFE_INTEGER) {
            return numeric
          }
        }
        return identifier
      })
    : undefined
  const build = match[5]?.split('.')
  return {
    build,
    major,
    minor,
    patch,
    prerelease,
  }
}

export function tryParse(
  version: VersionInput,
  options: VersionOptions = {},
): SemVer | null {
  try {
    return parse(version, options)
  } catch {
    return null
  }
}
