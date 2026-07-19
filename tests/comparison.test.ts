import { describe, expect, it } from 'vitest'

import {
  compare,
  compareBuild,
  compareMain,
  comparePrerelease,
  compareReversed,
  compareWithOperator,
  isEqual,
  isGreater,
  isGreaterOrEqual,
  isLess,
  isLessOrEqual,
  isNotEqual,
  sort,
  sortReversed,
} from '../src/comparison.ts'
import {
  compareIdentifiers,
  compareIdentifiersReversed,
} from '../src/identifiers.ts'
import { parse } from '../src/version.ts'
import comparisons from './fixtures/node-semver/comparisons.ts'
import equality from './fixtures/node-semver/equality.ts'
import type { VersionOptions } from '../src/types.ts'

type ComparisonCase = readonly [string, string, unknown?]

function versionOptions(value: unknown): VersionOptions {
  if (value === true) return { loose: true }
  return value && typeof value === 'object' ? (value as VersionOptions) : {}
}

describe('version comparison', () => {
  it('accepts parsed SemVer objects', () => {
    const left = parse('2.0.0+two')
    const right = parse('1.0.0+one')

    expect(compare(left, right)).toBe(1)
    expect(compareBuild(left, '2.0.0+one')).toBe(1)
    expect(isGreater(left, right)).toBe(true)
  })

  it('orders every comparison fixture', () => {
    for (const row of comparisons as readonly ComparisonCase[]) {
      const [left, right, rawOptions] = row
      const options = versionOptions(rawOptions)
      expect(compare(left, right, options)).toBe(1)
      expect(compareReversed(left, right, options)).toBe(-1)
      expect(isGreater(left, right, options)).toBe(true)
      expect(isGreaterOrEqual(left, right, options)).toBe(true)
      expect(isLess(right, left, options)).toBe(true)
      expect(isLessOrEqual(right, left, options)).toBe(true)
      expect(isNotEqual(left, right, options)).toBe(true)
    }
  })

  it('treats every equality fixture as equivalent', () => {
    for (const row of equality as readonly ComparisonCase[]) {
      const [left, right, rawOptions] = row
      const options = versionOptions(rawOptions)
      expect(compare(left, right, options)).toBe(0)
      expect(isEqual(left, right, options)).toBe(true)
      expect(compareWithOperator(left, '=', right, options)).toBe(true)
    }
  })

  it('compares main, prerelease, and build components independently', () => {
    expect(compareMain('1.2.3-alpha', '1.2.3')).toBe(0)
    expect(comparePrerelease('1.2.3-alpha', '9.9.9-beta')).toBe(-1)
    expect(compare('1.2.3+2', '1.2.3+1')).toBe(0)
    expect(compareBuild('1.2.3+2', '1.2.3+1')).toBe(1)
  })

  it('supports semver and identity operators', () => {
    expect(compareWithOperator('v1.2.3', '==', '1.2.3')).toBe(true)
    expect(compareWithOperator('v1.2.3', '===', '1.2.3')).toBe(false)
    expect(compareWithOperator('v1.2.3', '!==', '1.2.3')).toBe(true)
    expect(compareWithOperator('2.0.0', '>', '1.0.0')).toBe(true)
    expect(() =>
      compareWithOperator('1.0.0', 'not-an-operator' as never, '1.0.0'),
    ).toThrow(TypeError)
  })

  it('compares identifiers using semver precedence', () => {
    expect(compareIdentifiers(1, 2)).toBe(-1)
    expect(compareIdentifiers('2', 'alpha')).toBe(-1)
    expect(compareIdentifiers('beta', 'alpha')).toBe(1)
    expect(compareIdentifiersReversed('beta', 'alpha')).toBe(-1)
  })
})

describe('sorting', () => {
  it('preserves parsed object identities', () => {
    const lower = parse('1.0.0')
    const higher = parse('2.0.0')

    expect(sort([higher, lower])).toEqual([lower, higher])
    expect(sortReversed([lower, higher])).toEqual([higher, lower])
  })

  it('sorts by build-aware precedence without mutating the input', () => {
    const versions = ['1.0.0+2', '2.0.0', '1.0.0+1']
    const original = [...versions]

    expect(sort(versions)).toEqual(['1.0.0+1', '1.0.0+2', '2.0.0'])
    expect(sortReversed(versions)).toEqual(['2.0.0', '1.0.0+2', '1.0.0+1'])
    expect(versions).toEqual(original)
  })
})
