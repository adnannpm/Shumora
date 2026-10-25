import { expect, it } from 'vitest'
import { validateRelease, parseVersion } from '../scripts/release-utils.mjs'
it('requires a stable explicit version and a strictly higher version for preparation', () => {
  expect(parseVersion('0.2.0')).toEqual([0, 2, 0])
  for (const value of ['v0.2.0', '1.0', '01.2.0', '1.0.0-beta', '../1.0.0']) expect(() => parseVersion(value)).toThrow()
  expect(() => validateRelease({ version: '0.2.0', lockVersion: '0.1.0', notes: '# Changes\nFixed tabs.' })).toThrow(/lock/)
})
it('rejects unfinished notes and accepts ready notes unchanged', () => {
  for (const notes of ['', '# 0.2.0', '# Changes\nTODO', '# Changes\n- [ ] Write notes']) expect(() => validateRelease({ version: '0.2.0', lockVersion: '0.2.0', notes })).toThrow()
  const notes = '# Shumora 0.2.0\n\n## Improvements\n- Resizable terminal groups.\n'
  expect(validateRelease({ version: '0.2.0', lockVersion: '0.2.0', notes })).toBe(notes)
})
