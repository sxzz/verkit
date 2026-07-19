import {
  Range as NodeSemVerRange,
  coerce as semverCoerce,
  compare as semverCompare,
  inc as semverIncrement,
  parse as semverParse,
  satisfies as semverSatisfies,
  valid as semverValid,
} from 'semver'
import { bench, describe } from 'vitest'
import {
  coerce,
  compare,
  increment,
  normalize,
  parse,
  parseRange,
  satisfies,
} from '../src/index.ts'

const version = '12.34.56-beta.7+sha.abcdef'
const stableVersion = '12.34.56'
const coercionInput = 'release/12.34.56-beta.7+sha.abcdef'
const complexRange = '>=10.2.0 <11 || ^12.30.0 || 14.0.0 - 16.x'
// node-semver caches up to 1000 parsed range fragments. Cycling through more
// inputs ensures its cache cannot hide the cost of parsing string ranges.
const uncachedRanges = Array.from(
  { length: 1_001 },
  (_, patch) =>
    `>=10.2.${patch} <11 || ^12.30.${patch} || 14.0.${patch} - 16.x`,
)
const parsedVersion = parse(version)
const parsedStableVersion = parse(stableVersion)
const parsedComplexRange = parseRange(complexRange)
const semverParsedVersion = semverParse(version)!
const semverParsedStableVersion = semverParse(stableVersion)!
const semverParsedComplexRange = new NodeSemVerRange(complexRange)
let verkitRangeIndex = 0
let semverRangeIndex = 0

describe('parse and normalize', () => {
  bench('verkit', () => {
    normalize(version)
  })
  bench('semver', () => {
    semverValid(version)
  })
})

describe('compare', () => {
  bench('verkit', () => {
    compare(version, stableVersion)
  })
  bench('semver', () => {
    semverCompare(version, stableVersion)
  })
})

describe('compare parsed versions', () => {
  bench('verkit', () => {
    compare(parsedVersion, parsedStableVersion)
  })
  bench('semver', () => {
    semverCompare(semverParsedVersion, semverParsedStableVersion)
  })
})

describe('increment', () => {
  bench('verkit', () => {
    increment(version, 'prerelease')
  })
  bench('semver', () => {
    semverIncrement(version, 'prerelease')
  })
})

describe('coerce', () => {
  bench('verkit', () => {
    coerce(coercionInput, { includePrerelease: true })
  })
  bench('semver', () => {
    semverCoerce(coercionInput, { includePrerelease: true })
  })
})

describe('satisfies uncached ranges', () => {
  bench('verkit', () => {
    const range = uncachedRanges[verkitRangeIndex]!
    verkitRangeIndex = (verkitRangeIndex + 1) % uncachedRanges.length
    satisfies(stableVersion, range)
  })
  bench('semver', () => {
    const range = uncachedRanges[semverRangeIndex]!
    semverRangeIndex = (semverRangeIndex + 1) % uncachedRanges.length
    semverSatisfies(stableVersion, range)
  })
})

describe('satisfies pre-parsed inputs', () => {
  bench('verkit', () => {
    satisfies(parsedStableVersion, parsedComplexRange)
  })
  bench('semver', () => {
    semverSatisfies(semverParsedStableVersion, semverParsedComplexRange)
  })
})
