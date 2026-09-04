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
): readonly [string | null, boolean, number, string | null, number | null] {
  const coerced = coerce(version)
  return [
    normalize(version),
    satisfies(version, range),
    compare(version, '1.0.0'),
    increment(version, 'patch'),
    /* v8 ignore start -- @preserve */
    coerced?.major ?? null,
    /* v8 ignore stop -- @preserve */
  ]
}
