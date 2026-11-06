import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionManager } from '../src/main/sessions'
import { TerminalAgentSettings } from '../src/main/terminal-agent'

const main = vi.hoisted(() => ({
  handlers: new Map<string, Function>(),
  events: new Map<string, Function>(),
  ready: Promise.resolve(),
  directory: '',
  window: undefined as any,
  quit: vi.fn(),
  error: vi.fn(),
  spawn: vi.fn(),
  piDetect: vi.fn(),
  codeDetect: vi.fn(),
  packageRun: vi.fn(),
  packageStatus: vi.fn(() => ({ configured: true, installed: true, source: 'npm:test-package' }))
}))

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: () => true,
    on: (event: string, cb: Function) => main.events.set(event, cb),
    whenReady: () => ({
      then: (cb: () => Promise<void>) => {
        main.ready = cb()
        return main.ready
      }
    }),
    getPath: () => main.directory,
    getVersion: () => '1.0.0',
    quit: main.quit,
    isPackaged: false
  },
  BrowserWindow: class {
    webContents = {
      send() {},
      mainFrame: {},
      on() {},
      setWindowOpenHandler() {},
      session: { setPermissionRequestHandler() {} }
    }
    constructor() {
      main.window = this
    }
    on() {}
    loadFile() {}
    isDestroyed() {
      return false
    }
  },
  ipcMain: { handle: (channel: string, cb: Function) => main.handlers.set(channel, cb) },
  nativeTheme: { on() {} },
  dialog: { showErrorBox: main.error },
  clipboard: {},
  shell: {},
  Notification: {}
}))
vi.mock('node-pty', () => ({ spawn: main.spawn }))
vi.mock('electron-updater', () => ({ autoUpdater: { on() {} } }))
vi.mock('../src/main/meeting-bridge', () => ({
  MeetingBridge: class {
    async listen() {}
    dispose() {}
    register() {
      return 'test'
    }
    remove() {}
    skillCounts() {
      return {}
    }
    status() {
      return 'disconnected'
    }
  }
}))
vi.mock('../src/main/askpass-service', () => ({
  AskPassService: class {
    setHandler() {}
    async start() {}
    dispose() {}
  }
}))
vi.mock('../src/main/launch', () => ({
  enrichedPath: (_platform: string, env: NodeJS.ProcessEnv) => env.PATH,
  resolveLaunch: () => ({ file: 'pi', args: [] })
}))
vi.mock('../src/main/plugin-host', () => ({
  piPluginHost: { detect: main.piDetect, run: vi.fn() },
  opencodePluginHost: { detect: main.codeDetect, run: vi.fn() },
  pluginHost: {},
  managerPluginHosts: { pnpm: {}, bun: {}, yarn: {} },
  routerHost: {},
  runPiPackage: main.packageRun,
  resolveOpenCodeLaunch: () => ({ file: 'opencode', args: [] }),
  isTerminalAgentAvailable: () => true
}))
vi.mock('../src/main/package-status', () => ({ packageStatus: main.packageStatus }))

function createMockPty() {
  return {
    onData: () => ({ dispose() {} }),
    onExit: () => ({ dispose() {} }),
    write() {},
    resize() {},
    kill() {}
  }
}

async function startMain(saved: unknown = []) {
  vi.resetModules()
  main.handlers.clear()
  main.events.clear()
  main.quit.mockClear()
  main.error.mockClear()
  main.spawn.mockClear()
  main.directory = mkdtempSync(join(tmpdir(), 'shumora-main-test-'))
  writeFileSync(join(main.directory, 'workspace-terminals.json'), JSON.stringify(saved))

  const installed = { installed: true, installedVersion: '1.0.0', managed: true, packageManager: 'npm' }
  main.piDetect.mockReset().mockResolvedValue(installed)
  main.codeDetect.mockReset().mockResolvedValue(installed)
  main.packageRun.mockReset().mockResolvedValue(undefined)
  main.spawn.mockImplementation(createMockPty)

  await import('../src/main/index')
  await main.ready

  return (channel: string, ...args: unknown[]) =>
    main.handlers.get(channel)!({ sender: main.window?.webContents, senderFrame: main.window?.webContents.mainFrame }, ...args)
}

function deferred<T = unknown>() {
  let release!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolve, fail) => {
    release = resolve
    reject = fail
  })
  return { promise, release, reject }
}

it('persists the agent for future sessions even with open tabs and rejects missing agents', async () => {
  const db = new Database(':memory:')
  const settings = new TerminalAgentSettings(db, async agent => agent === 'pi')
  expect((await settings.status()).active).toBe('pi')
  await expect(settings.select('opencode')).rejects.toThrow('not installed')

  const both = new TerminalAgentSettings(db, async () => true)
  const launched: string[] = []
  const sessions = new SessionManager(
    (_cwd, _id, _generation, agent) => {
      launched.push(agent)
      return createMockPty()
    },
    () => {}
  )

  const existing = sessions.create('/workspace', undefined, both.active())
  expect((await both.status()).canChange).toBe(true)
  expect((await both.select('opencode')).active).toBe('opencode')
  expect(sessions.snapshot(existing.id).session.status).toBe('running')
  expect(launched).toEqual(['pi'])

  sessions.create('/workspace', undefined, both.active())
  sessions.restart(existing.id)
  expect(launched).toEqual(['pi', 'opencode', 'pi'])

  sessions.dispose()
  expect(new TerminalAgentSettings(db, async () => true).active()).toBe('opencode')
  await expect(both.select('bad' as any)).rejects.toThrow('Invalid')
  db.close()
})

describe('main-process session/runtime locks', () => {
  afterEach(() => {
    main.events.get('will-quit')?.()
    if (main.directory) rmSync(main.directory, { recursive: true, force: true })
  })

  it.each(['pi', 'opencode'] as const)(
    'keeps %s locked throughout deferred runtime detection, without locking the other runtime',
    async agent => {
      const invoke = await startMain()
      const related = invoke('sessions:create', main.directory, agent)
      invoke('sessions:stop', related.id)

      const gate = deferred()
      ;(agent === 'pi' ? main.piDetect : main.codeDetect).mockReturnValueOnce(gate.promise)

      const operation = invoke(`${agent === 'pi' ? 'pi' : 'opencode'}-plugin:mutate`, 'uninstall') as Promise<unknown>
      const rejection = expect(operation).rejects.toThrow('deliberately blocked detection')

      expect(() => invoke('sessions:create', main.directory, agent)).toThrow('runtime installation operation')
      expect(() => invoke('sessions:restart', related.id)).toThrow('runtime installation operation')

      const other = invoke('sessions:create', main.directory, agent === 'pi' ? 'opencode' : 'pi')
      invoke('sessions:stop', other.id)
      expect(invoke('sessions:restart', other.id).status).toBe('running')

      if (agent === 'pi') {
        await expect(invoke('packages:mutate', 'uninstall', 'test-package')).rejects.toThrow('Pi installation operation')
      }

      gate.reject(new Error('deliberately blocked detection'))
      await rejection
      expect(invoke('sessions:restart', related.id).status).toBe('running')
    }
  )

  it('locks Pi package and runtime mutation in both acquisition orders, while OpenCode remains running', async () => {
    const invoke = await startMain()
    const pi = invoke('sessions:create', main.directory, 'pi')
    const code = invoke('sessions:create', main.directory, 'opencode')

    const gate = deferred()
    main.packageRun.mockReturnValueOnce(gate.promise)

    const operation = invoke('packages:mutate', 'uninstall', 'test-package') as Promise<unknown>
    const rejection = expect(operation).rejects.toThrow('package state does not match')

    expect(invoke('sessions:snapshot', pi.id).session.status).toBe('exited')
    expect(invoke('sessions:snapshot', code.id).session.status).toBe('running')
    await expect(invoke('pi-plugin:mutate', 'uninstall')).rejects.toThrow('Pi package operation')
    expect(() => invoke('sessions:create', main.directory, 'pi')).toThrow('package operation')
    expect(() => invoke('sessions:restart', pi.id)).toThrow('package operation')
    expect(invoke('sessions:create', main.directory, 'opencode').status).toBe('running')

    gate.release(undefined)
    await rejection
  })

  it('offers runnable terminals even when package ownership detection fails', async () => {
    const invoke = await startMain()
    main.piDetect.mockRejectedValue(new Error('package version could not be verified'))
    main.codeDetect.mockRejectedValue(new Error('unmanaged installation'))

    expect(await invoke('terminal-agent:status')).toMatchObject({ installed: { pi: true, opencode: true } })
    expect(invoke('sessions:create', main.directory, 'pi').status).toBe('running')
  })

  it('uses running session identities rather than the Settings default for runtime guards', async () => {
    const invoke = await startMain()
    const pi = invoke('sessions:create', main.directory, 'pi')

    await invoke('terminal-agent:select', 'opencode')
    await expect(invoke('pi-plugin:mutate', 'uninstall')).rejects.toThrow('Stop running Pi sessions')

    invoke('sessions:stop', pi.id)
    invoke('sessions:create', main.directory, 'opencode')

    await invoke('terminal-agent:select', 'pi')
    await expect(invoke('opencode-plugin:mutate', 'uninstall')).rejects.toThrow('Stop running OpenCode sessions')
  })

  it('reports an invalid saved identity without spawning a default or overwriting the saved workspace', async () => {
    const saved = [
      { id: 'bad', name: 'Keep me', cwd: '/tmp', agent: 'invalid' },
      { id: 'valid', name: 'Keep too', cwd: '/tmp', agent: 'pi' }
    ]
    await startMain(saved)

    expect(main.error).toHaveBeenCalledWith('Could not restore workspace', expect.stringContaining('Invalid terminal agent'))
    expect(main.quit).toHaveBeenCalledOnce()
    expect(main.spawn).not.toHaveBeenCalled()
    expect(JSON.parse(readFileSync(join(main.directory, 'workspace-terminals.json'), 'utf8'))).toEqual(saved)
  })
})
