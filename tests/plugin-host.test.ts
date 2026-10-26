import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'

const exec = vi.hoisted(() => ({ callback: undefined as any, child: undefined as any }))
vi.mock('node:child_process', () => ({ execFile: vi.fn((_file, _args, _options, callback) => { exec.callback = callback; return exec.child }) }))
vi.mock('node:fs', () => ({
  accessSync: (file: string) => { if (!file.endsWith('/npm')) throw new Error('not found') },
  constants: { F_OK: 0, X_OK: 1 }, existsSync: () => false, readFileSync: vi.fn(), realpathSync: (file: string) => file
}))
import { pluginHost } from '../src/main/plugin-host'

it('forwards stdout and stderr while npm is still running, then rejects on failure', async () => {
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const chunks: string[] = []
  const pending = pluginHost.run(['install', '--global', '9router@0.5.109'], text => chunks.push(text))
  let settled = false
  void pending.then(() => { settled = true }, () => { settled = true })
  exec.child.stdout.emit('data', 'downloading\n')
  exec.child.stderr.emit('data', 'npm WARN example\n')
  expect(chunks).toEqual(['downloading\n', 'npm WARN example\n'])
  expect(settled).toBe(false)
  exec.callback(new Error('npm exited 1'), '', 'EACCES')
  await expect(pending).rejects.toThrow('EACCES')
})
