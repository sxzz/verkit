import { describe, expect, it } from 'vitest'

import {
  comparatorsIntersect,
  normalizeComparator,
  satisfiesComparator,
} from '../src/comparator.ts'
import { parse } from '../src/version.ts'
import comparatorIntersections from './fixtures/node-semver/comparator-intersection.ts'

type IntersectionCase = readonly [string, string, boolean, boolean?]

describe('comparators', () => {
  it('normalizes and tests strict comparators', () => {
    expect(normalizeComparator(' >= 1.2.3+build ')).toBe('>=1.2.3')
    expect(satisfiesComparator('1.2.3+other', '>=1.2.3')).toBe(true)
    expect(satisfiesComparator('1.2.3-alpha', '>=1.2.3')).toBe(false)
    expect(satisfiesComparator(parse('1.2.3'), '>=1.2.3')).toBe(true)
    expect(() => normalizeComparator('not a comparator')).toThrow(TypeError)
  })

  it('matches every comparator intersection fixture', () => {
    for (const row of comparatorIntersections as readonly IntersectionCase[]) {
      const [left, right, expected, includePrerelease = false] = row
      expect(comparatorsIntersect(left, right, { includePrerelease })).toBe(
        expected,
      )
    }
  })

  it('applies the prerelease rule to an exact-version comparator', () => {
    const cases: readonly IntersectionCase[] = [
      ['1.2.3-a', '>1.0.0', false],
      ['1.2.3-a', '>=1.0.0', false],
      ['1.2.3-a', '<2.0.0', false],
      ['1.2.3-a', '<=2.0.0', false],
      ['=1.2.3-a', '<2.0.0', false],
      ['1.2.3-a', '>=1.2.3', false],
      ['>1.0.0', '1.2.3-a', false],
      ['<2.0.0', '1.2.3-a', false],
      ['>=1.2.3', '=1.2.3-a', false],
      // the rule is satisfied: same tuple, and the other side is a prerelease
      ['1.2.3-a', '>=1.2.3-a', true],
      ['1.2.3-a', '<1.2.3-b', true],
      ['1.2.3-a', '=1.2.3-a', true],
      ['>=1.2.3-a', '1.2.3-a', true],
      ['1.2.3-a', '>1.0.0', true, true],
      ['1.2.3-a', '<2.0.0', true, true],
      // plain versions are untouched
      ['1.2.3', '>1.0.0', true],
      ['1.2.3', '<1.0.0', false],
      ['>1.0.0', '1.2.3', true],
    ]

    for (const [left, right, expected, includePrerelease = false] of cases) {
      expect(comparatorsIntersect(left, right, { includePrerelease })).toBe(
        expected,
      )
    }
  })
})
