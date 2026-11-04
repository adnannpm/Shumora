import { _electron as electron } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const profile = await mkdtemp(join(tmpdir(), 'shumora-performance-smoke-'))
await writeFile(join(profile, 'workspace-terminals.json'), '[]')
let app
const deadline = setTimeout(() => { console.error('Performance smoke timed out'); process.exit(1) }, 60000)
try {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '' }
  delete env.ELECTRON_RENDERER_URL
  app = await electron.launch({ args: [`--user-data-dir=${profile}`, '.'], env, timeout: 20000 })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.evaluate(() => {
    localStorage.setItem('shumora.setup-completed', 'true')
    // Release version comes from package metadata; ignore welcome dialogs via Escape below.
  })
  await page.reload()
  const gotIt = page.getByRole('button', { name: 'Got it', exact: true })
  if (await gotIt.isVisible()) await gotIt.click()
  await page.waitForFunction(() => !!window.workspace)
  assert.deepEqual(await page.evaluate(() => window.workspace.list()), [])
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Terminals', exact: true }).click()
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor()
  // Create real native PTYs through the supported API, then verify independent snapshots/restart.
  const result = await page.evaluate(async () => {
    const a = await window.workspace.create('/tmp')
    const b = await window.workspace.create('/tmp')
    const snapshots = await Promise.all([window.workspace.snapshot(a.id), window.workspace.snapshot(b.id)])
    const restarted = await window.workspace.restart(a.id)
    const next = await window.workspace.snapshot(a.id)
    await window.workspace.close(a.id)
    await window.workspace.close(b.id)
    return { statuses: [a.status, b.status], generations: [a.generation, restarted.generation], nextGeneration: next.session.generation, ids: snapshots.map(s => s.session.id), remaining: await window.workspace.list() }
  })
  assert.deepEqual(result.statuses, ['running', 'running'])
  assert.equal(new Set(result.ids).size, 2)
  assert.equal(result.generations[1], result.generations[0] + 1)
  assert.equal(result.nextGeneration, result.generations[1])
  assert.deepEqual(result.remaining, [])
  assert.deepEqual(errors, [])
  console.log('PASS: production UI, lazy Library navigation twice, native PTY creation, independent snapshots, restart generation, cleanup; no renderer errors.')
} finally {
  if (app) {
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) await win.webContents.executeJavaScript('window.workspace.list().then(async list => { for (const s of list) await window.workspace.close(s.id) })').catch(() => {})
    }).catch(() => {})
    await app.close()
  }
  clearTimeout(deadline)
  await rm(profile, { recursive: true, force: true })
}
