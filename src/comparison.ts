import {
  compareBuildParsed,
  compareMainParsed,
  compareParsed,
  comparePrereleaseParsed,
  parse,
} from './internal/version.ts'
import type {
  Comparison,
  ComparisonOperator,
  VersionInput,
  VersionOptions,
} from './types.ts'

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

export function isGreater(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) > 0
}

export function isGreaterOrEqual(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) >= 0
}

export function isLess(
  left: VersionInput,
  right: VersionInput,
  options: VersionOptions = {},
): boolean {
  return compare(left, right, options) < 0
}

export function isLessOrEqual(
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
  return versions.toSorted((left, right) => compareBuild(left, right, options))
}

export function sortReversed<T extends VersionInput>(
  versions: readonly T[],
  options: VersionOptions = {},
): T[] {
  return versions.toSorted((left, right) => compareBuild(right, left, options))
}
