// Runs under `deno test` (Deno.test) and under node 22 (node:test) with the same test files.
export { default as assert } from 'node:assert/strict'
const g = globalThis as any
export const test: (name: string, fn: () => unknown | Promise<unknown>) => void =
  g.Deno?.test ? (n, f) => g.Deno.test(n, f as () => void | Promise<void>) : ((await import('node:test')).test as unknown as (n: string, f: () => unknown) => void)
