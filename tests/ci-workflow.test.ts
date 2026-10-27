import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parse } from 'yaml'

const workflow = (name: string) => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'))
it('validates every release platform before merge, including packaging', () => {
  const ci = workflow('ci')
  const release = workflow('release')
  expect(ci.jobs.platform.strategy.matrix.include).toEqual(release.jobs.build.strategy.matrix.include)
  expect(ci.jobs.platform.strategy['fail-fast']).toBe(false)
  const commands = ci.jobs.platform.steps.map((step: { run?: string }) => step.run || '').join('\n')
  expect(commands).toContain('npm ci')
  expect(commands).toContain('npm test')
  expect(commands).toContain('npm run build')
  expect(commands).toContain('electron-builder --dir')
  expect(commands).toContain('--publish never')
  expect(ci.jobs.platform.steps.some((step: { 'continue-on-error'?: boolean }) => step['continue-on-error'])).toBe(false)
})
it('keeps a stable verify gate that fails if any platform fails or is cancelled', () => {
  const gate = workflow('ci').jobs.verify
  expect(gate.needs).toContain('platform')
  expect(gate.if).toBe('always()')
  expect(gate.steps[0].env.RESULT).toBe('${{ needs.platform.result }}')
  expect(gate.steps[0].run).toContain('test "$RESULT" = success')
})
