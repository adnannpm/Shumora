import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { packageStatus } from '../src/main/package-status'
it('requires both a personal Pi declaration and matching package manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-status-'))
  try {
    expect(packageStatus('@demo/tools', dir).installed).toBe(false)
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ packages: [{ source: 'npm:@demo/tools@1.0.0' }] }))
    expect(packageStatus('@demo/tools', dir)).toMatchObject({ configured: true, installed: false })
    mkdirSync(join(dir, 'npm/node_modules/@demo/tools'), { recursive: true })
    writeFileSync(join(dir, 'npm/node_modules/@demo/tools/package.json'), JSON.stringify({ name: '@demo/tools', version: '1.0.0' }))
    expect(packageStatus('@demo/tools', dir)).toMatchObject({ installed: true, installedVersion: '1.0.0', source: 'npm:@demo/tools@1.0.0' })
    expect(() => packageStatus('../bad', dir)).toThrow()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
