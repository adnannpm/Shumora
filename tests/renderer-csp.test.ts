import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

it('permits terminal WebAssembly without permitting JavaScript eval or remote scripts', () => {
  const html = readFileSync(new URL('../src/renderer/index.html', import.meta.url), 'utf8')
  const script = /script-src ([^;]+)/.exec(html)![1]
  expect(script.split(' ')).toContain("'wasm-unsafe-eval'")
  expect(script.split(' ')).toContain("'self'")
  expect(script.split(' ')).not.toContain("'unsafe-eval'")
  expect(script).not.toMatch(/https?:|\*/)
})
