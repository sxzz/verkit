import { describe, expect, it } from 'vitest'

import {
  clean,
  coerce,
  difference,
  getBuild,
  getMajor,
  getMinor,
  getPatch,
  getPrerelease,
  increment,
  isValid,
  normalize,
  normalizeFull,
  parse,
  truncate,
  tryParse,
} from '../src/version.ts'
import increments from './fixtures/node-semver/increments.ts'
import invalidVersions from './fixtures/node-semver/invalid-versions.ts'
import truncations from './fixtures/node-semver/truncations.ts'
import validVersions from './fixtures/node-semver/valid-versions.ts'
import type {
  IncrementOptions,
  IncrementType,
  PrereleaseIdentifier,
  SemVer,
  TruncationType,
  VersionDifference,
  VersionOptions,
} from '../src/types.ts'

type ValidVersionCase = readonly [
  string,
  number,
  number,
  number,
  readonly PrereleaseIdentifier[],
  readonly string[],
]

type InvalidVersionCase = readonly [unknown, string, unknown?]
type IncrementCase = readonly [
  string,
  string,
  string | null,
  unknown?,
  unknown?,
  unknown?,
]
type TruncationCase = readonly [string, string, string | null]

function versionOptions(value: unknown): VersionOptions {
  if (value === true) return { loose: true }
  return value && typeof value === 'object' ? (value as VersionOptions) : {}
}

function incrementOptions(
  rawOptions: unknown,
  rawIdentifier: unknown,
  rawBase: unknown,
): IncrementOptions {
  if (typeof rawOptions === 'string') {
    return {
      identifier: rawOptions,
      identifierBase: normalizeIdentifierBase(rawIdentifier),
    }
  }
  return {
    ...versionOptions(rawOptions),
    identifier: typeof rawIdentifier === 'string' ? rawIdentifier : undefined,
    identifierBase: normalizeIdentifierBase(rawBase),
  }
}

function normalizeIdentifierBase(value: unknown): 0 | 1 | false | undefined {
  if (value === false) return false
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  return undefined
}

describe('version parsing and accessors', () => {
  it('parses reusable mutable SemVer objects', () => {
    const version = parse('1.2.3-rc.1+build.7')

    expect(version).toEqual({
      build: ['build', '7'],
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['rc', 1],
    })
    expect(parse(version)).toBe(version)
    expect(() => parse('not a version')).toThrow(
      'Invalid version syntax: not a version',
    )
    expect(() => parse('9007199254740992.0.0')).toThrow(
      'Invalid major version: 9007199254740992',
    )
    expect(() => parse(`1.2.3+${'x'.repeat(256)}`)).toThrow(
      'Version exceeds the maximum length of 256 characters',
    )
    expect(tryParse('not a version')).toBeNull()

    version.patch = 4
    version.prerelease![0] = 'beta'
    version.build = ['next']

    expect(isValid(version)).toBe(true)
    expect(normalizeFull(version)).toBe('1.2.4-beta.1+next')
    expect(normalize(version)).toBe('1.2.4-beta.1')
    expect(clean(version)).toBe('1.2.4-beta.1')
    expect(coerce(version)).toBe('1.2.4-beta.1+next')
    expect(increment(version, 'minor')).toBe('1.3.0')
    expect(truncate(version, 'patch')).toBe('1.2.4')
    expect(getMajor(version)).toBe(1)
    expect(getMinor(version)).toBe(2)
    expect(getPatch(version)).toBe(4)
    expect(getPrerelease(version)).toEqual(['beta', 1])
    expect(getBuild(version)).toEqual(['next'])
  })

  it('accepts SemVer objects without empty identifier arrays', () => {
    const version: SemVer = { major: 1, minor: 2, patch: 3 }
    const parsed = parse('1.2.3')

    expect(parse(version)).toBe(version)
    expect(parsed.prerelease).toBeUndefined()
    expect(parsed.build).toBeUndefined()
    expect(normalizeFull(version)).toBe('1.2.3')
    expect(increment(version, 'patch')).toBe('1.2.4')
    expect(getPrerelease(version)).toEqual([])
    expect(getBuild(version)).toEqual([])
  })

  it('accepts every valid node-semver fixture', () => {
    for (const row of validVersions as readonly ValidVersionCase[]) {
      const [version, major, minor, patch, prerelease, build] = row
      const comparable = `${major}.${minor}.${patch}${prerelease.length ? `-${prerelease.join('.')}` : ''}`
      const full = `${comparable}${build.length ? `+${build.join('.')}` : ''}`

      expect(isValid(version)).toBe(true)
      expect(normalizeFull(version)).toBe(full)
      expect(normalize(version)).toBe(comparable)
      expect(getMajor(version)).toBe(major)
      expect(getMinor(version)).toBe(minor)
      expect(getPatch(version)).toBe(patch)
      expect(getPrerelease(version)).toEqual(prerelease)
      expect(getBuild(version)).toEqual(build)
    }
  })

  it('rejects every invalid node-semver fixture', () => {
    for (const row of invalidVersions as readonly InvalidVersionCase[]) {
      const [version, , rawOptions] = row
      if (typeof version !== 'string') continue
      const options = versionOptions(rawOptions)
      expect(isValid(version, options)).toBe(false)
      expect(normalizeFull(version, options)).toBeNull()
      expect(normalize(version, options)).toBeNull()
    }
  })

  it('keeps full and comparable normalization distinct', () => {
    expect(normalizeFull('v1.2.3-rc.1+sha.abc')).toBe('1.2.3-rc.1+sha.abc')
    expect(normalize('v1.2.3-rc.1+sha.abc')).toBe('1.2.3-rc.1')
    expect(clean(' =v1.2.3+build ')).toBe('1.2.3')
  })

  it('uses strict accessors for invalid input', () => {
    expect(() => getMajor('not a version')).toThrow(TypeError)
    expect(() => getMinor('not a version')).toThrow(TypeError)
    expect(() => getPatch('not a version')).toThrow(TypeError)
    expect(() => difference('1.0.0', 'nope')).toThrow(TypeError)
  })
})

describe('version operations', () => {
  it('matches every increment fixture', () => {
    for (const row of increments as readonly IncrementCase[]) {
      const [version, release, expected, options, identifier, base] = row
      expect(
        increment(
          version,
          release as IncrementType,
          incrementOptions(options, identifier, base),
        ),
      ).toBe(expected)
    }
  })

  it('matches every truncation fixture', () => {
    for (const row of truncations as readonly TruncationCase[]) {
      const [version, truncation, expected] = row
      expect(truncate(version, truncation as TruncationType)).toBe(expected)
    }
  })

  it('coerces left-to-right, right-to-left, and prerelease forms', () => {
    expect(coerce('release 1.2.3.4')).toBe('1.2.3')
    expect(coerce('release 1.2.3.4', { rtl: true })).toBe('2.3.4')
    expect(coerce('v2')).toBe('2.0.0')
    expect(coerce('1.2.3-rc.1+build.7', { includePrerelease: true })).toBe(
      '1.2.3-rc.1+build.7',
    )
    expect(coerce('not a version')).toBeNull()
    expect(coerce('9'.repeat(17))).toBeNull()
  })

  it('reports node-semver-compatible differences', () => {
    const cases: readonly (readonly [
      string,
      string,
      VersionDifference | null,
    ])[] = [
      ['1.2.3', '0.2.3', 'major'],
      ['0.2.3', '1.2.3', 'major'],
      ['1.4.5', '0.2.3', 'major'],
      ['1.2.3', '2.0.0-pre', 'premajor'],
      ['2.0.0-pre', '1.2.3', 'premajor'],
      ['1.2.3', '1.3.3', 'minor'],
      ['1.0.1', '1.1.0-pre', 'preminor'],
      ['1.2.3', '1.2.4', 'patch'],
      ['1.2.3', '1.2.4-pre', 'prepatch'],
      ['0.0.1', '0.0.1-pre', 'patch'],
      ['0.0.1', '0.0.1-pre-2', 'patch'],
      ['1.1.0', '1.1.0-pre', 'minor'],
      ['1.1.0-pre-1', '1.1.0-pre-2', 'prerelease'],
      ['1.0.0', '1.0.0', null],
      ['1.0.0-1', '1.0.0-1', null],
      ['0.0.2-1', '0.0.2', 'patch'],
      ['0.0.2-1', '0.0.3', 'patch'],
      ['0.0.2-1', '0.1.0', 'minor'],
      ['0.0.2-1', '1.0.0', 'major'],
      ['0.1.0-1', '0.1.0', 'minor'],
      ['1.0.0-1', '1.0.0', 'major'],
      ['1.0.0-1', '1.1.1', 'major'],
      ['1.0.0-1', '2.1.1', 'major'],
      ['1.0.1-1', '1.0.1', 'patch'],
      ['0.0.0-1', '0.0.0', 'major'],
      ['1.0.0-1', '2.0.0', 'major'],
      ['1.0.0-1', '2.0.0-1', 'premajor'],
      ['1.0.0-1', '1.1.0-1', 'preminor'],
      ['1.0.0-1', '1.0.1-1', 'prepatch'],
      ['1.7.2-1', '1.8.1', 'minor'],
      ['1.1.1-pre', '2.1.1-pre', 'premajor'],
      ['1.1.1-pre', '2.1.1', 'major'],
      ['1.2.3-1', '1.2.3', 'patch'],
      ['1.4.0-1', '2.3.5', 'major'],
      ['1.6.1-5', '1.7.2', 'minor'],
      ['2.0.0-1', '2.1.1', 'major'],
      ['1.2.3+one', '1.2.3+two', null],
    ]

    for (const [left, right, expected] of cases) {
      expect(difference(left, right)).toBe(expected)
    }
  })
})
