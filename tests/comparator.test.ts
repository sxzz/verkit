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
})
