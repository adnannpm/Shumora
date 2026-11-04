import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import assert from 'node:assert/strict'
import ts from 'typescript'

// Compile in memory so this runs with the repo's supported Node versions.
const source = readFileSync(new URL('../src/main/terminal-history.ts', import.meta.url), 'utf8')
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 })
const { TerminalHistory } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const chunks = Array.from({ length: 20_000 }, (_, i) => `\x1b[32m${i}: ${'terminal output '.repeat(15)}\x1b[0m\r\n`)
function run(legacy) {
  const history = new TerminalHistory(512_000)
  let output = ''
  const start = performance.now()
  for (const chunk of chunks) {
    if (legacy) output = (output + chunk).slice(-512_000)
    else history.append(chunk)
  }
  if (!legacy) output = history.text()
  return { ms: performance.now() - start, output }
}
run(true); run(false)
const samples = []
for (let i = 0; i < 5; i++) {
  const previous = run(true), current = run(false)
  assert.equal(current.output, previous.output)
  samples.push({ previous_ms: previous.ms, current_ms: current.ms })
}
const median = key => samples.map(s => s[key]).sort((a, b) => a - b)[2]
console.log(JSON.stringify({ workload: '20,000 ANSI chunks, 512,000 UTF-16 units retained, final snapshot', samples, median_previous_ms: median('previous_ms'), median_current_ms: median('current_ms'), warning: 'Buffer microbenchmark only; not app RAM or end-to-end speed.' }, null, 2))
