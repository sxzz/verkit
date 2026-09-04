import { compareMainParsed, compareParsed } from './comparison.ts'
import { TRUNCATION_TYPES } from './constants.ts'
import { compareIdentifiers } from './identifiers.ts'
import {
  formatComparableVersion,
  formatFullVersion,
  parse,
  tryParse,
} from './parse.ts'
import {
  COERCE,
  COERCE_FULL,
  PRERELEASE,
  PRERELEASE_LOOSE,
  safeRegex,
} from './patterns.ts'
import type {
  CoerceOptions,
  IncrementOptions,
  IncrementType,
  PrereleaseIdentifier,
  SemVer,
  TruncationType,
  VersionDifference,
  VersionInput,
  VersionOptions,
} from './types.ts'

const COERCE_EXACT = safeRegex(COERCE)
const COERCE_FULL_EXACT = safeRegex(COERCE_FULL)
const PRERELEASE_EXACT = safeRegex(`^${PRERELEASE}$`)
const PRERELEASE_LOOSE_EXACT = safeRegex(`^${PRERELEASE_LOOSE}$`)

export function isValid(
  version: VersionInput,
  options: VersionOptions = {},
): boolean {
  return tryParse(version, options) !== null
}

export function isPrerelease(
  version: VersionInput,
  options: VersionOptions = {},
): boolean | null {
  const parsed = tryParse(version, options)
  if (!parsed) return null
  return !!parsed.prerelease?.length
}

export function isStable(
  version: VersionInput,
  options: VersionOptions = {},
): boolean | null {
  const parsed = tryParse(version, options)
  if (!parsed) return null
  return !parsed.prerelease?.length
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
): SemVer | null {
  if (typeof value === 'object') return value
  const input = typeof value === 'number' ? String(value) : value
  let match: RegExpExecArray | null = null

  if (options.rtl) {
    const source = options.includePrerelease ? COERCE_FULL : COERCE
    const expression = safeRegex(source, 'g')
    let next: RegExpExecArray | null
    while (
      (next = expression.exec(input)) &&
      (!match || match.index + match[0].length !== input.length)
    ) {
      if (
        !match ||
        next.index + next[0].length !== match.index + match[0].length
      ) {
        match = next
      }
      expression.lastIndex = next.index + next[1]!.length + next[2]!.length
    }
  } else {
    match = (options.includePrerelease ? COERCE_FULL_EXACT : COERCE_EXACT).exec(
      input,
    )
  }
  if (!match) return null

  const major = match[2]
  const minor = match[3] || '0'
  const patch = match[4] || '0'
  const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : ''
  const build = options.includePrerelease && match[6] ? `+${match[6]}` : ''
  return tryParse(`${major}.${minor}.${patch}${prerelease}${build}`, options)
}

function isPrereleasePrefix(
  prerelease: readonly PrereleaseIdentifier[],
  identifier: string,
): boolean {
  const identifiers = identifier.split('.')
  return (
    identifiers.length <= prerelease.length &&
    identifiers.every(
      (part, index) => compareIdentifiers(prerelease[index]!, part) === 0,
    )
  )
}

function incrementPrerelease(
  version: SemVer,
  identifier: string | undefined,
  identifierBase: 0 | 1 | false | undefined,
): void {
  const base = Number(identifierBase) ? 1 : 0
  let prerelease = version.prerelease
  if (prerelease?.length) {
    let foundNumeric = false
    for (let index = prerelease.length - 1; index >= 0; index--) {
      if (typeof prerelease[index] === 'number') {
        prerelease[index] = Number(prerelease[index]) + 1
        foundNumeric = true
        break
      }
    }
    if (!foundNumeric) {
      if (identifier === prerelease.join('.') && identifierBase === false) {
        throw new Error('invalid increment argument: identifier already exists')
      }
      prerelease.push(base)
    }
  } else {
    prerelease = [base]
    version.prerelease = prerelease
  }

  if (!identifier) return
  const reset: PrereleaseIdentifier[] =
    identifierBase === false ? [identifier] : [identifier, base]
  if (isPrereleasePrefix(prerelease, identifier)) {
    const next = prerelease[identifier.split('.').length]
    if (Number.isNaN(Number(next))) version.prerelease = reset
  } else {
    version.prerelease = reset
  }
}

function incrementMutable(
  version: SemVer,
  release: IncrementType | 'pre',
  identifier: string | undefined,
  identifierBase: 0 | 1 | false | undefined,
): void {
  switch (release) {
    case 'premajor':
      version.prerelease = undefined
      version.patch = 0
      version.minor = 0
      version.major++
      incrementPrerelease(version, identifier, identifierBase)
      break
    case 'preminor':
      version.prerelease = undefined
      version.patch = 0
      version.minor++
      incrementPrerelease(version, identifier, identifierBase)
      break
    case 'prepatch':
      version.prerelease = undefined
      incrementMutable(version, 'patch', identifier, identifierBase)
      incrementPrerelease(version, identifier, identifierBase)
      break
    case 'prerelease':
      if (!version.prerelease?.length) {
        incrementMutable(version, 'patch', identifier, identifierBase)
      }
      incrementPrerelease(version, identifier, identifierBase)
      break
    case 'release':
      if (!version.prerelease?.length) {
        throw new Error(
          `version ${formatFullVersion(version)} is not a prerelease`,
        )
      }
      version.prerelease = undefined
      break
    case 'major':
      if (
        version.minor !== 0 ||
        version.patch !== 0 ||
        !version.prerelease?.length
      ) {
        version.major++
      }
      version.minor = 0
      version.patch = 0
      version.prerelease = undefined
      break
    case 'minor':
      if (version.patch !== 0 || !version.prerelease?.length) {
        version.minor++
      }
      version.patch = 0
      version.prerelease = undefined
      break
    case 'patch':
      if (!version.prerelease?.length) version.patch++
      version.prerelease = undefined
      break
    /* v8 ignore next */
    case 'pre':
      incrementPrerelease(version, identifier, identifierBase)
      break
    default:
      throw new Error(`invalid increment argument: ${release as string}`)
  }
}

function incrementParsedVersion(
  parsed: SemVer,
  release: IncrementType,
  identifier?: string,
  identifierBase?: 0 | 1 | false,
  loose = false,
): string {
  if (release.startsWith('pre')) {
    if (!identifier && identifierBase === false) {
      throw new Error('invalid increment argument: identifier is empty')
    }
    if (identifier) {
      const expression = loose ? PRERELEASE_LOOSE_EXACT : PRERELEASE_EXACT
      const match = `-${identifier}`.match(expression)
      if (!match || match[1] !== identifier) {
        throw new Error(`invalid identifier: ${identifier}`)
      }
    }
  }

  const mutable: SemVer = {
    build: parsed.build ? [...parsed.build] : undefined,
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    prerelease: parsed.prerelease ? [...parsed.prerelease] : undefined,
  }
  incrementMutable(mutable, release, identifier, identifierBase)
  return formatComparableVersion(mutable)
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
  const highHasPrerelease = high.prerelease?.length
  const lowHasPrerelease = low.prerelease?.length
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
  return parsed ? [...(parsed.prerelease || [])] : null
}

export function getBuild(
  version: VersionInput,
  options: VersionOptions = {},
): string[] | null {
  const parsed = tryParse(version, options)
  return parsed ? [...(parsed.build || [])] : null
}
