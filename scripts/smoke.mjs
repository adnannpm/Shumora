import { _electron as electron } from '@playwright/test'
import { strict as assert } from 'node:assert'
import { mkdir } from 'node:fs/promises'

// Hard deadline also covers a stalled Chromium DevTools handshake.
const deadline = setTimeout(() => { console.error('Desktop smoke test timed out (DevTools/display connection).'); process.exit(1) }, 45000)
const app = await electron.launch({ args: ['.'], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' }, timeout: 30000 })
try {
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  console.log('Window opened:', await page.title())
  page.on('console', (message) => console.log('renderer:', message.text()))
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const notes = page.getByRole('button', { name: 'Got it', exact: true })
  if (await notes.isVisible()) await notes.click()
  await page.getByRole('tab', { name: 'Pi 1' }).waitFor()
  await page.waitForFunction(() => window.workspace !== undefined)
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
  const first = await page.evaluate(() => window.workspace.list())
  assert.equal(first.length, 1)
  assert.equal(first[0].status, 'running', first[0].error)
  await page.waitForFunction(async () => (await window.workspace.snapshot((await window.workspace.list())[0].id)).output.length > 0)
  await page.getByRole('button', { name: 'New session in group 1' }).click()
  await page.getByRole('tab', { name: 'Pi 2' }).waitFor()
  await page.getByRole('button', { name: 'Split right' }).click()
  assert.equal(await page.locator('.terminal-pane:visible').count(), 2)
  await page.getByRole('button', { name: 'Merge groups' }).click()
  assert.equal(await page.locator('.terminal-pane:visible').count(), 1)
  assert.equal((await page.evaluate(() => window.workspace.list())).filter((s) => s.status === 'running').length, 2)
  await mkdir('ai-artifacts/verification', { recursive: true })
  await page.screenshot({ path: 'ai-artifacts/verification/mvp-linux.png' })
  const stopped = await page.evaluate(async () => {
    const list = await window.workspace.list()
    for (const s of list) await window.workspace.stop(s.id)
    return window.workspace.list()
  })
  assert(stopped.every((s) => s.status === 'exited'))
  assert.deepEqual(errors, [])
  console.log('PASS: actual Pi startup/output, isolated renderer, two native PTYs, session tabs, split/merge, hidden process survival, stop cleanup.')
} finally {
  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      await win.webContents.executeJavaScript('window.workspace.list().then(async list => { for (const s of list) await window.workspace.stop(s.id) })').catch(() => {})
    }
  }).catch(() => {})
  await app.close()
  clearTimeout(deadline)
}
