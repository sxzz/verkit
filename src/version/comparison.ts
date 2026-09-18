import { compareIdentifiers } from './identifiers.ts'
import { parse } from './parse.ts'
import type {
  Comparison,
  ComparisonOperator,
  SemVer,
  VersionInput,
  VersionOptions,
} from './types.ts'

export function compareMainParsed(left: SemVer, right: SemVer): Comparison {
  return left.major === right.major
    ? left.minor === right.minor
      ? left.patch === right.patch
        ? 0
        : left.patch < right.patch
          ? -1
          : 1
      : left.minor < right.minor
        ? -1
        : 1
    : left.major < right.major
      ? -1
      : 1
}

export function comparePrereleaseParsed(
  left: SemVer,
  right: SemVer,
): Comparison {
  const leftPrerelease = left.prerelease
  const rightPrerelease = right.prerelease
  if (leftPrerelease?.length && !rightPrerelease?.length) return -1
  if (!leftPrerelease?.length && rightPrerelease?.length) return 1
  if (!leftPrerelease?.length && !rightPrerelease?.length) return 0

  for (let index = 0; ; index++) {
    const leftIdentifier = leftPrerelease?.[index]
    const rightIdentifier = rightPrerelease?.[index]
    if (leftIdentifier === undefined && rightIdentifier === undefined) return 0
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === undefined) return -1
    if (leftIdentifier !== rightIdentifier) {
      return compareIdentifiers(leftIdentifier, rightIdentifier)
    }
  }
}

export function compareParsed(left: SemVer, right: SemVer): Comparison {
  return compareMainParsed(left, right) || comparePrereleaseParsed(left, right)
}

export function compareBuildParsed(left: SemVer, right: SemVer): Comparison {
  const precedence = compareParsed(left, right)
  if (precedence !== 0) return precedence

  for (let index = 0; ; index++) {
    const leftIdentifier = left.build?.[index]
    const rightIdentifier = right.build?.[index]
    if (leftIdentifier === undefined && rightIdentifier === undefined) return 0
    if (rightIdentifier === undefined) return 1
    if (leftIdentifier === undefined) return -1
    if (leftIdentifier !== rightIdentifier) {
      return compareIdentifiers(leftIdentifier, rightIdentifier)
    }
  }
}

export function compare(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): Comparison {
  return compareParsed(parse(left, options), parse(right, options))
}

export function compareReversed(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): Comparison {
  return compare(right, left, options)
}

export function compareMain(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): Comparison {
  return compareMainParsed(parse(left, options), parse(right, options))
}

export function comparePrerelease(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): Comparison {
  return comparePrereleaseParsed(parse(left, options), parse(right, options))
}

export function compareBuild(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): Comparison {
  return compareBuildParsed(parse(left, options), parse(right, options))
}

export function compareWithOperator(
  left: VersionInput,
  operator: ComparisonOperator,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  if (operator === '===') return left === right
  if (operator === '!==') return left !== right
  const comparison = compare(left, right, options)
  switch (operator) {
    case '':
    case '=':
    case '==':
      return comparison === 0
    case '!=':
      return comparison !== 0
    case '>':
      return comparison > 0
    case '>=':
      return comparison >= 0
    case '<':
      return comparison < 0
    case '<=':
      return comparison <= 0
    default:
      throw new TypeError(`Invalid operator: ${operator as string}`)
  }
}

export function isEqual(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) === 0
}

export function isNotEqual(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) !== 0
}

export function isGreaterThan(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) > 0
}

export function isGreaterThanOrEqual(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) >= 0
}

export function isLessThan(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) < 0
}

export function isLessThanOrEqual(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) <= 0
}

export function sort<T extends VersionInput>(
  versions: readonly T[],
  options: VersionOptions = {},
): T[] {
  return [...versions].sort((left, right) => compareBuild(left, right, options))
}

export function sortReversed<T extends VersionInput>(
  versions: readonly T[],
  options: VersionOptions = {},
): T[] {
  return [...versions].sort((left, right) => compareBuild(right, left, options))
}
