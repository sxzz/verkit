import { coerce, compare, inc, satisfies, valid } from 'semver'

export function runCommonOperations(
  version: string,
  range: string,
): readonly [string | null, boolean, number, string | null, string | null] {
  return [
    valid(version),
    satisfies(version, range),
    compare(version, '1.0.0'),
    inc(version, 'patch'),
    coerce(version)?.version ?? null,
  ]
}
