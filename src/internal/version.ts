import { MAX_LENGTH } from '../constants.ts'
import { compareIdentifiers } from '../identifiers.ts'
import {
  COERCE,
  COERCE_FULL,
  FULL_PLAIN,
  LOOSE_PLAIN,
  PRERELEASE,
  PRERELEASE_LOOSE,
  safeRegex,
} from './patterns.ts'
import type {
  Comparison,
  IncrementType,
  PrereleaseIdentifier,
  SemVer,
  VersionInput,
  VersionOptions,
} from '../types.ts'

const FULL = safeRegex(`^${FULL_PLAIN}$`)
const LOOSE = safeRegex(`^${LOOSE_PLAIN}$`)
const PRERELEASE_EXACT = safeRegex(`^${PRERELEASE}$`)
const PRERELEASE_LOOSE_EXACT = safeRegex(`^${PRERELEASE_LOOSE}$`)
const COERCE_EXACT = safeRegex(COERCE)
const COERCE_FULL_EXACT = safeRegex(COERCE_FULL)
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

export function compareMainParsed(left: SemVer, right: SemVer): Comparison {
  return left.major === right.major
    ? left.minor === right.minor
      ? left.patch === right.patch
        ? 0
        : left.patch < right.patch
          ? -1
          : 1
      : left.minor < right.minor
        ? -1
        : 1
    : left.major < right.major
      ? -1
      : 1
}

export function comparePrereleaseParsed(
  left: SemVer,
  right: SemVer,
): Comparison {
  const leftPrerelease = left.prerelease
  const rightPrerelease = right.prerelease
  if (leftPrerelease?.length && !rightPrerelease?.length) return -1
  if (!leftPrerelease?.length && rightPrerelease?.length) return 1
  if (!leftPrerelease?.length && !rightPrerelease?.length) return 0

  for (let index = 0; ; index++) {
    const leftIdentifier = leftPrerelease?.[index]
    const rightIdentifier = rightPrerelease?.[index]
    if (leftIdentifier === undefined && rightIdentifier === undefined) return 0
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === undefined) return -1
    if (leftIdentifier !== rightIdentifier) {
      return compareIdentifiers(leftIdentifier, rightIdentifier)
    }
  }
}

export function compareParsed(left: SemVer, right: SemVer): Comparison {
  return compareMainParsed(left, right) || comparePrereleaseParsed(left, right)
}

export function compareBuildParsed(left: SemVer, right: SemVer): Comparison {
  const precedence = compareParsed(left, right)
  if (precedence !== 0) return precedence

  for (let index = 0; ; index++) {
    const leftIdentifier = left.build?.[index]
    const rightIdentifier = right.build?.[index]
    if (leftIdentifier === undefined && rightIdentifier === undefined) return 0
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === undefined) return -1
    if (leftIdentifier !== rightIdentifier) {
      return compareIdentifiers(leftIdentifier, rightIdentifier)
    }
  }
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
    case 'pre':
      incrementPrerelease(version, identifier, identifierBase)
      break
    default:
      throw new Error(`invalid increment argument: ${release as string}`)
  }
}

export function incrementParsedVersion(
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

export function coerceParsedVersion(
  value: number | VersionInput,
  options: {
    includePrerelease?: boolean
    loose?: boolean
    rtl?: boolean
  } = {},
): SemVer | null {
  if (typeof value === 'object') return value
  const input = typeof value === 'number' ? String(value) : value
  if (typeof input !== 'string') return null
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
