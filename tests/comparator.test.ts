import { describe, expect, it } from 'vitest'

import {
  comparatorsIntersect,
  normalizeComparator,
  parseComparator,
  satisfiesComparator,
  tryParseComparator,
} from '../src/comparator.ts'
import { parse } from '../src/version.ts'
import comparatorIntersections from './fixtures/node-semver/comparator-intersection.ts'

type IntersectionCase = readonly [string, string, boolean, boolean?]

describe('comparators', () => {
  it('parses reusable mutable comparators', () => {
    const comparator = parseComparator('>=1.2.3')

    expect(comparator).toEqual({
      operator: '>=',
      options: {},
      value: '>=1.2.3',
      version: parse('1.2.3'),
    })
    expect(parseComparator(comparator)).toBe(comparator)
    expect(tryParseComparator(comparator)).toBe(comparator)
    expect(tryParseComparator('not a comparator')).toBeNull()
    expect(() => parseComparator('not a comparator')).toThrow(TypeError)

    comparator.version!.patch = 4
    expect(normalizeComparator(comparator)).toBe('>=1.2.4')
    expect(satisfiesComparator('1.2.4', comparator)).toBe(true)
    expect(comparatorsIntersect(comparator, parseComparator('<2.0.0'))).toBe(
      true,
    )
  })

  it('normalizes and tests strict comparators', () => {
    expect(normalizeComparator(' >= 1.2.3+build ')).toBe('>=1.2.3')
    expect(satisfiesComparator('1.2.3+other', '>=1.2.3')).toBe(true)
    expect(satisfiesComparator('1.2.3-alpha', '>=1.2.3')).toBe(false)
    expect(satisfiesComparator('not a version', '>=1.2.3')).toBe(false)
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
