import type { Comparison, PrereleaseIdentifier } from './types.ts'

const NUMERIC = /^\d+$/

export function compareIdentifiers(
  left: PrereleaseIdentifier,
  right: PrereleaseIdentifier,
): Comparison {
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right ? 0 : left < right ? -1 : 1
  }

  const leftNumeric = NUMERIC.test(String(left))
  const rightNumeric = NUMERIC.test(String(right))
  const normalizedLeft = leftNumeric ? Number(left) : left
  const normalizedRight = rightNumeric ? Number(right) : right

  return normalizedLeft === normalizedRight
    ? 0
    : leftNumeric && !rightNumeric
      ? -1
      : rightNumeric && !leftNumeric
        ? 1
        : normalizedLeft < normalizedRight
          ? -1
          : 1
}

export function compareIdentifiersReversed(
  left: PrereleaseIdentifier,
  right: PrereleaseIdentifier,
): Comparison {
  return compareIdentifiers(right, left)
}
