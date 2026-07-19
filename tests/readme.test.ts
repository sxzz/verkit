import { describe, expect, it } from 'vitest'

import {
  coerce,
  compare,
  compareBuild,
  findMaxSatisfying,
  increment,
  normalize,
  normalizeFull,
  normalizeRange,
  parse,
  parseRange,
  satisfies,
  sortReversed,
  truncate,
} from '../src/index.ts'

describe('README examples', () => {
  it('keeps version operation examples executable', () => {
    const version = parse('1.2.3-rc.1+sha.abc')
    version.patch = 4

    expect(normalizeFull(version)).toBe('1.2.4-rc.1+sha.abc')
    expect(normalize(version)).toBe('1.2.4-rc.1')
    expect(increment(version, 'minor')).toBe('1.3.0')
    expect(truncate(version, 'patch')).toBe('1.2.4')
    expect(coerce('release 42.6.7.9', { rtl: true })).toBe('6.7.9')
  })

  it('keeps comparison and range examples executable', () => {
    expect(compare('1.0.0+one', '1.0.0+two')).toBe(0)
    expect(compareBuild('1.0.0+one', '1.0.0+two')).toBe(-1)
    expect(sortReversed(['1.0.0', '2.0.0'])).toEqual(['2.0.0', '1.0.0'])
    const range = parseRange('^1.2.3')
    expect(normalizeRange(range)).toBe('>=1.2.3 <2.0.0-0')
    expect(satisfies('1.5.0', range)).toBe(true)
    expect(findMaxSatisfying(['1.2.3', '1.5.0', '2.0.0'], range)).toBe('1.5.0')
  })
})
