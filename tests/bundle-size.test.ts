import { Buffer } from 'node:buffer'
import { join } from 'node:path'
import { stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  brotliCompressSync,
  gzipSync,
  constants as zlibConstants,
} from 'node:zlib'

import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'

import { runCommonOperations as runSemverOperations } from './fixtures/bundle-size/semver.ts'
import { runCommonOperations as runVerkitOperations } from './fixtures/bundle-size/verkit.ts'

interface BundleSize {
  readonly brotli: number
  readonly gzip: number
  readonly minified: number
}

const { dirname } = import.meta
const entries = {
  full: {
    semver: fileURLToPath(import.meta.resolve('semver')),
    verkit: join(dirname, '../src/index.ts'),
  },
  common: {
    semver: join(dirname, 'fixtures/bundle-size/semver.ts'),
    verkit: join(dirname, 'fixtures/bundle-size/verkit.ts'),
  },
} as const

const VERKIT_BUDGETS: Record<'common' | 'full', BundleSize> = {
  common: {
    brotli: 3_700,
    gzip: 4_000,
    minified: 12_000,
  },
  full: {
    brotli: 5_500,
    gzip: 6_000,
    minified: 20_000,
  },
}

async function getMinifiedBundleSize(input: string): Promise<BundleSize> {
  const bundle = await rolldown({ input, treeshake: true })
  try {
    // Use the exact same minification pipeline for both consumers so the
    // comparison measures their tree-shaken runtime code, not build settings.
    const output = await bundle.generate({ format: 'esm', minify: true })
    const chunk = output.output.find((item) => item.type === 'chunk')
    if (!chunk) throw new Error(`Rolldown did not emit a chunk for ${input}`)
    const code = Buffer.from(chunk.code)

    return {
      brotli: brotliCompressSync(code, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
        },
      }).byteLength,
      gzip: gzipSync(code, { level: 9 }).byteLength,
      minified: code.byteLength,
    }
  } finally {
    await bundle.close()
  }
}

function formatSize(size: BundleSize): string {
  return `min ${size.minified} B, gzip ${size.gzip} B, brotli ${size.brotli} B`
}

function expectSmallerAndWithinBudget(
  verkit: BundleSize,
  semver: BundleSize,
  budget: BundleSize,
): void {
  expect(verkit.minified).toBeLessThan(semver.minified)
  expect(verkit.gzip).toBeLessThan(semver.gzip)
  expect(verkit.brotli).toBeLessThan(semver.brotli)
  expect(verkit.minified).toBeLessThanOrEqual(budget.minified)
  expect(verkit.gzip).toBeLessThanOrEqual(budget.gzip)
  expect(verkit.brotli).toBeLessThanOrEqual(budget.brotli)
}

describe('bundle size', () => {
  it('is smaller than minified npm semver for a full import', async () => {
    const [verkit, semver] = await Promise.all([
      getMinifiedBundleSize(entries.full.verkit),
      getMinifiedBundleSize(entries.full.semver),
    ])

    expectSmallerAndWithinBudget(verkit, semver, VERKIT_BUDGETS.full)

    stdout.write(
      `\nBundle size (full/CDN) — verkit: ${formatSize(verkit)}; semver: ${formatSize(semver)}\n`,
    )
  })

  it('is smaller than minified npm semver for common imports', async () => {
    const [verkit, semver] = await Promise.all([
      getMinifiedBundleSize(entries.common.verkit),
      getMinifiedBundleSize(entries.common.semver),
    ])

    expect(runVerkitOperations('1.2.3', '^1.0.0')).toEqual(
      runSemverOperations('1.2.3', '^1.0.0'),
    )
    expectSmallerAndWithinBudget(verkit, semver, VERKIT_BUDGETS.common)

    stdout.write(
      `\nBundle size (common imports) — verkit: ${formatSize(verkit)}; semver: ${formatSize(semver)}\n`,
    )
  })
})
