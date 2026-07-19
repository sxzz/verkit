import {
  coerce,
  compare,
  increment,
  normalize,
  satisfies,
} from '../../../src/index.ts'

export function runCommonOperations(
  version: string,
  range: string,
): readonly [string | null, boolean, number, string | null, string | null] {
  return [
    normalize(version),
    satisfies(version, range),
    compare(version, '1.0.0'),
    increment(version, 'patch'),
    coerce(version),
  ]
}
