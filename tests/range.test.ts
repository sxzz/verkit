import { describe, expect, it } from 'vitest'

import {
  findMaxSatisfying,
  findMinimumForRange,
  findMinSatisfying,
  isGreaterThanRange,
  isLessThanRange,
  isOutsideRange,
  isRangeSubset,
  isValidRange,
  normalizeRange,
  parseRange,
  rangesIntersect,
  rangeToComparators,
  satisfies,
  simplifyRange,
  tryParseRange,
} from '../src/range.ts'
import { parse } from '../src/version.ts'
import rangeExclude from './fixtures/node-semver/range-exclude.ts'
import rangeInclude from './fixtures/node-semver/range-include.ts'
import rangeIntersections from './fixtures/node-semver/range-intersection.ts'
import rangeParse from './fixtures/node-semver/range-parse.ts'
import rangeSubsets from './fixtures/node-semver/range-subset.ts'
import versionGtRange from './fixtures/node-semver/version-gt-range.ts'
import versionLtRange from './fixtures/node-semver/version-lt-range.ts'
import versionNotGtRange from './fixtures/node-semver/version-not-gt-range.ts'
import versionNotLtRange from './fixtures/node-semver/version-not-lt-range.ts'
import type { RangeOptions } from '../src/types.ts'

type RangeCase = readonly [string, string, unknown?]
type RangeParseCase = readonly [string, string | null, unknown?]
type RangeIntersectionCase = readonly [string, string, boolean, unknown?]
type RangeSubsetCase = readonly [string, string, boolean, unknown?]

function rangeOptions(value: unknown): RangeOptions {
  if (value === true) return { loose: true }
  return value && typeof value === 'object' ? (value as RangeOptions) : {}
}

describe('range parsing and satisfaction', () => {
  it('parses reusable SemVerRange objects', () => {
    const range = parseRange('^1.2.3')

    expect(range.raw).toBe('^1.2.3')
    expect(range.normalized).toBe('>=1.2.3 <2.0.0-0')
    expect(parseRange(range)).toBe(range)
    expect(() => parseRange('not a range')).toThrow('Invalid comparator: not')
    expect(tryParseRange('not a range')).toBeNull()
    expect(isValidRange(range)).toBe(true)
    expect(normalizeRange(range)).toBe('>=1.2.3 <2.0.0-0')
    expect(satisfies('1.5.0', range)).toBe(true)
    expect(rangeToComparators(range)).toEqual([['>=1.2.3', '<2.0.0-0']])
    expect(findMinimumForRange(range)).toBe('1.2.3')
    expect(rangesIntersect(range, '>=1.5.0')).toBe(true)
    expect(isRangeSubset(range, '1.x')).toBe(true)
  })

  it('returns independent mutable SemVerRange objects', () => {
    const options: RangeOptions = {}
    const first = parseRange('^1.2.3', options)
    const second = parseRange('^1.2.3', options)

    expect(first.sets).not.toBe(second.sets)
    expect(first.sets[0]).not.toBe(second.sets[0])
    expect(first.sets[0]![0]!.version).not.toBe(second.sets[0]![0]!.version)

    first.raw = 'mutated'
    first.normalized = '>1.2.9'
    first.options.includePrerelease = true
    first.sets[0]![0]!.operator = '>'
    first.sets[0]![0]!.value = '>1.2.9'
    first.sets[0]![0]!.version!.patch = 9

    expect(second.raw).toBe('^1.2.3')
    expect(second.normalized).toBe('>=1.2.3 <2.0.0-0')
    expect(second.options.includePrerelease).toBeUndefined()
    expect(options.includePrerelease).toBeUndefined()
    expect(second.sets[0]![0]!.operator).toBe('>=')
    expect(second.sets[0]![0]!.value).toBe('>=1.2.3')
    expect(second.sets[0]![0]!.version!.patch).toBe(3)
  })

  it('accepts parsed SemVer objects', () => {
    expect(satisfies(parse('1.5.0'), '^1.2.3')).toBe(true)
  })

  it('normalizes every range fixture', () => {
    for (const row of rangeParse as readonly RangeParseCase[]) {
      const [range, expected, rawOptions] = row
      const options = rangeOptions(rawOptions)
      expect(normalizeRange(range, options)).toBe(expected)
      expect(isValidRange(range, options)).toBe(expected !== null)
    }
  })

  it('includes every positive range fixture', () => {
    for (const row of rangeInclude as readonly RangeCase[]) {
      const [range, version, rawOptions] = row
      expect(satisfies(version, range, rangeOptions(rawOptions))).toBe(true)
    }
  })

  it('excludes every negative range fixture', () => {
    for (const row of rangeExclude as readonly RangeCase[]) {
      const [range, version, rawOptions] = row
      expect(satisfies(version, range, rangeOptions(rawOptions))).toBe(false)
    }
  })

  it('converts disjunctions to comparator sets', () => {
    expect(rangeToComparators('^1.2.3 || ~2.0')).toEqual([
      ['>=1.2.3', '<2.0.0-0'],
      ['>=2.0.0', '<2.1.0-0'],
    ])
    expect(() => rangeToComparators('not a range')).toThrow(TypeError)
    expect(satisfies('1.0.0', 'not a range')).toBe(false)
  })
})

describe('range sets', () => {
  it('matches every range intersection fixture', () => {
    for (const row of rangeIntersections as readonly RangeIntersectionCase[]) {
      const [left, right, expected, rawOptions] = row
      expect(rangesIntersect(left, right, rangeOptions(rawOptions))).toBe(
        expected,
      )
    }
  })

  it('finds satisfying extrema and theoretical minimums', () => {
    const versions = ['1.2.3', '1.5.0', '2.0.0', '1.4.0']
    expect(findMaxSatisfying(versions, '^1.2.0')).toBe('1.5.0')
    expect(findMinSatisfying(versions, '^1.2.0')).toBe('1.2.3')
    expect(findMaxSatisfying(versions, 'invalid')).toBeNull()
    expect(findMinimumForRange('>1.2.3')).toBe('1.2.4')
    expect(findMinimumForRange('>1.2.3-alpha.1')).toBe('1.2.3-alpha.1.0')
    expect(findMinimumForRange('<0.0.0')).toBeNull()
  })

  it('returns parsed extrema by identity', () => {
    const lower = parse('1.2.3')
    const higher = parse('1.5.0')
    const outside = parse('2.0.0')
    const versions = [higher, outside, lower]

    expect(findMaxSatisfying(versions, '^1.0.0')).toBe(higher)
    expect(findMinSatisfying(versions, '^1.0.0')).toBe(lower)
    expect(isGreaterThanRange(outside, '^1.0.0')).toBe(true)
    expect(simplifyRange(versions, '>=1.0.0 <2.0.0')).toBe('<=1.5.0')
  })

  it('matches every minimum-version behavior case', () => {
    const cases: readonly (readonly [string, string | null])[] = [
      ['*', '0.0.0'],
      ['* || >=2', '0.0.0'],
      ['>=2 || *', '0.0.0'],
      ['>2 || *', '0.0.0'],
      ['1.0.0', '1.0.0'],
      ['1.0', '1.0.0'],
      ['1.0.x', '1.0.0'],
      ['1.0.*', '1.0.0'],
      ['1', '1.0.0'],
      ['1.x.x', '1.0.0'],
      ['1.*.x', '1.0.0'],
      ['1.x.*', '1.0.0'],
      ['1.x', '1.0.0'],
      ['1.*', '1.0.0'],
      ['=1.0.0', '1.0.0'],
      ['~1.1.1', '1.1.1'],
      ['~1.1.1-beta', '1.1.1-beta'],
      ['~1.1.1 || >=2', '1.1.1'],
      ['^1.1.1', '1.1.1'],
      ['^1.1.1-beta', '1.1.1-beta'],
      ['^1.1.1 || >=2', '1.1.1'],
      ['^2.16.2 ^2.16', '2.16.2'],
      ['1.1.1 - 1.8.0', '1.1.1'],
      ['1.1 - 1.8.0', '1.1.0'],
      ['<2', '0.0.0'],
      ['<0.0.0-beta', '0.0.0-0'],
      ['<0.0.1-beta', '0.0.0'],
      ['<2 || >4', '0.0.0'],
      ['>4 || <2', '0.0.0'],
      ['<=2 || >=4', '0.0.0'],
      ['>=4 || <=2', '0.0.0'],
      ['<0.0.0-beta >0.0.0-alpha', '0.0.0-alpha.0'],
      ['>0.0.0-alpha <0.0.0-beta', '0.0.0-alpha.0'],
      ['>=1.1.1 <2 || >=2.2.2 <2', '1.1.1'],
      ['>=2.2.2 <2 || >=1.1.1 <2', '1.1.1'],
      ['>1.0.0', '1.0.1'],
      ['>1.0.0-0', '1.0.0-0.0'],
      ['>1.0.0-beta', '1.0.0-beta.0'],
      ['>2 || >1.0.0', '1.0.1'],
      ['>2 || >1.0.0-0', '1.0.0-0.0'],
      ['>2 || >1.0.0-beta', '1.0.0-beta.0'],
      ['>4 <3', null],
    ]

    for (const [range, expected] of cases) {
      expect(findMinimumForRange(range)).toBe(expected)
    }
  })

  it('matches every subset behavior fixture', () => {
    for (const row of rangeSubsets as readonly RangeSubsetCase[]) {
      const [subset, superset, expected, rawOptions] = row
      expect(isRangeSubset(subset, superset, rangeOptions(rawOptions))).toBe(
        expected,
      )
    }
  })

  it('simplifies over a copied array', () => {
    const versions = [
      '1.0.0',
      '1.0.1',
      '1.0.2',
      '1.0.3',
      '1.0.4',
      '1.1.0',
      '1.1.1',
      '1.1.2',
      '1.2.0',
      '1.2.1',
      '1.2.2',
      '1.2.3',
      '1.2.4',
      '1.2.5',
      '2.0.0',
      '2.0.1',
      '2.1.0',
      '2.1.1',
      '2.1.2',
      '2.2.0',
      '2.2.1',
      '2.2.2',
      '2.3.0',
      '2.3.1',
      '2.4.0',
      '3.0.0',
      '3.1.0',
      '3.2.0',
      '3.3.0',
    ]
    const original = [...versions]
    expect(simplifyRange(versions, '1.x')).toBe('1.x')
    expect(
      simplifyRange(versions, '1.0.0 || 1.0.1 || 1.0.2 || 1.0.3 || 1.0.4'),
    ).toBe('<=1.0.4')
    expect(simplifyRange(versions, '>=3.0.0 <3.1.0')).toBe('3.0.0')
    expect(simplifyRange(versions, '3.0.0 || 3.1 || 3.2 || 3.3')).toBe(
      '>=3.0.0',
    )
    expect(simplifyRange(versions, '1 || 2 || 3')).toBe('*')
    expect(simplifyRange(versions, '2.1 || 2.2 || 2.3')).toBe('2.1.0 - 2.3.1')
    expect(versions).toEqual(original)
  })
})

describe('outside ranges', () => {
  it('matches every greater-than fixture', () => {
    for (const row of versionGtRange as readonly RangeCase[]) {
      const [range, version, rawOptions] = row
      expect(isGreaterThanRange(version, range, rangeOptions(rawOptions))).toBe(
        true,
      )
    }
    for (const row of versionNotGtRange as readonly RangeCase[]) {
      const [range, version, rawOptions] = row
      expect(isGreaterThanRange(version, range, rangeOptions(rawOptions))).toBe(
        false,
      )
    }
  })

  it('matches every less-than fixture', () => {
    for (const row of versionLtRange as readonly RangeCase[]) {
      const [range, version, rawOptions] = row
      expect(isLessThanRange(version, range, rangeOptions(rawOptions))).toBe(
        true,
      )
    }
    for (const row of versionNotLtRange as readonly RangeCase[]) {
      const [range, version, rawOptions] = row
      expect(isLessThanRange(version, range, rangeOptions(rawOptions))).toBe(
        false,
      )
    }
  })

  it('rejects an invalid direction', () => {
    expect(() => isOutsideRange('1.0.0', '*', '?' as never)).toThrow(TypeError)
  })
})
