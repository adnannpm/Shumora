import { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme } from 'electron'
import { homedir } from 'node:os'
import { openFolderArgument } from './open-folder'
import { collectDiagnostics } from './diagnostics'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import * as pty from 'node-pty'
import { SessionManager } from './sessions'
import { MeetingBridge } from './meeting-bridge'
import { meetingExtensionPath } from './meeting-extension-path'
import { MeetingManager } from './meetings'
import type { MeetingInput } from '../shared/meetings'
import { resolveLaunch, enrichedPath } from './launch'
import { autoUpdater } from 'electron-updater'
import { UpdateManager } from './updates'
import { openDatabase } from './database'
import { PackageService } from './packages'
import { packageStatus, configuredPackageNames } from './package-status'
import { checkLibraryUpdates } from './library-updates'
import { fetchPackagePage } from './package-fetch'
import { PluginService, piDefinition } from './plugins'
import { pluginHost, piPluginHost, routerHost, runPiPackage } from './plugin-host'
import { routerLogin, routerLogout, routerAuthStatus } from './router-auth'
import { RouterCatalog } from './router-catalog'
import { RouterService } from './router-service'
import { routerKeys, routerCreateKey } from './router-keys'
import { routerHealth } from './router-health'
import type { PluginAction } from '../shared/plugins'
import { GitService } from './git'
import { generateCommitMessage, routerChatModels } from './commit-message'

process.env.PATH = enrichedPath(process.platform, process.env)

let window: BrowserWindow | undefined
let folder = homedir()
let closing = false
let rendererReady = false
const pendingFolders: string[] = []
const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) app.quit()
app.on('second-instance', (_event, argv) => {
  const target = openFolderArgument(argv)
  if (target) { pendingFolders.push(target); if (rendererReady) flushFolders() }
  if (window?.isMinimized()) window.restore()
  window?.show(); window?.focus()
})
function flushFolders() {
  while (pendingFolders.length) {
    const target = pendingFolders.shift()!
    try {
      if (packages.operation().status === 'running') throw new Error('Wait for the package operation to finish before opening a folder.')
      if (sessions.list().length >= 32) throw new Error('Workspace supports up to 32 sessions.')
      const session = sessions.create(target)
      window?.webContents.send('sessions:event', { type: 'opened', session })
    } catch (error) { void dialog.showMessageBox({ type: 'error', title: 'Open in Shumora', message: String(error) }) }
  }
}
let database: ReturnType<typeof openDatabase> | undefined
const bridge = new MeetingBridge(() => publishMeeting())
const meetings = new MeetingManager(bridge, () => publishMeeting())
function meetingSnapshot() {
  return { state: meetings.snapshot(), agents: Object.fromEntries(sessions.list().map(s => [s.id, s.status === 'running' ? bridge.status(s.id) : 'disconnected'])) }
}
function publishMeeting() {
  if (window && !window.isDestroyed()) window.webContents.send('meetings:change', meetingSnapshot())
}
const sessions = new SessionManager((cwd, id, generation) => {
  if (!statSync(cwd).isDirectory()) throw new Error('Working directory is not a folder')
  const launch = resolveLaunch(process.platform, process.env, process.env.PATH || process.env.Path || '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE')) as Record<string, string>
  const token = bridge.register(id, generation)
  const extension = meetingExtensionPath(app.isPackaged, process.resourcesPath, __dirname)
  try {
    return pty.spawn(launch.file, [...launch.args, '--extension', extension], { name: 'xterm-256color', cols: 100, rows: 30, cwd, env: { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor', SHUMORA_MEETING_PORT: String(bridge.port), SHUMORA_MEETING_TOKEN: token } })
  } catch (error) { bridge.remove(id); throw error }
}, (event) => {
  if (event.type === 'removed' || (event.type === 'state' && event.session.status !== 'running')) bridge.remove(event.type === 'removed' ? event.id : event.session.id)
  if (window && !window.isDestroyed()) window.webContents.send('sessions:event', event)
  if (event.type !== 'data') publishMeeting()
})

let updates: UpdateManager
const packages = new PackageService(fetchPackagePage, runPiPackage, () => {}, operation => {
  if (window && !window.isDestroyed()) window.webContents.send('packages:operation', operation)
}, packageStatus, sessions)
let plugins: PluginService
let piPlugin: PluginService<'pi'>
const router = new RouterService(routerHost)
const catalog = new RouterCatalog()
const git = new GitService((file) => shell.trashItem(file))
// Git calls take a session id; the working directory always comes from the main process.
function sessionCwd(id: unknown) {
  const session = sessions.list().find((s) => s.id === id)
  if (!session) throw new Error('Unknown session')
  return session.cwd
}
function registerIPC() {
  const handlers: Record<string, (...args: any[]) => unknown> = {
    'appearance:system-dark': () => nativeTheme.shouldUseDarkColors,
    'diagnostics:run': () => collectDiagnostics(),
    'meetings:snapshot': () => meetingSnapshot(),
    'meetings:start': (input: MeetingInput) => {
      if (!input || !Array.isArray(input.participants)) throw new Error('Invalid meeting setup')
      const list = sessions.list()
      const participants = input.participants.map(p => {
        const session = list.find(s => s.id === p?.id && s.status === 'running')
        if (!session) throw new Error('Meeting agent is not ready')
        return { id: session.id, name: session.name, role: p.role }
      })
      meetings.start({ ...input, participants })
    },
    'meetings:pause': () => meetings.pause(),
    'meetings:resume': () => meetings.resume(),
    'meetings:stop': () => meetings.stop(),
    'meetings:take-over': () => meetings.takeOver(),
    'meetings:direction': text => meetings.direction(text),
    'packages:updates': scope => checkLibraryUpdates({ names: configuredPackageNames, status: packageStatus, latest: async name => (await packages.detail(name)).version, plugins: [{ id: 'pi', check: () => piPlugin.status(true) }, { id: '9router', check: () => plugins.status(true) }] }, scope),
    'packages:detail': name => packages.detail(name),
    'packages:status': name => packages.status(name),
    'packages:mutate': (action, name, version) => packages.mutate(action, name, version),
    'packages:catalog': query => packages.catalog(query),
    'packages:install': (name, version) => packages.install(name, version),
    'packages:operation': () => packages.operation(),
    'pi-plugin:status': (refresh) => { if (refresh !== undefined && typeof refresh !== 'boolean') throw new Error('Invalid refresh flag'); return piPlugin.status(refresh) },
    'pi-plugin:operation': () => piPlugin.operation(),
    'pi-plugin:mutate': (action, version) => piPlugin.mutate(action, version),
    'plugins:status': (refresh: boolean) => {
      if (refresh !== undefined && typeof refresh !== 'boolean') throw new Error('Invalid refresh flag')
      return plugins.status(refresh)
    },
    'plugins:router-login': password => routerLogin(password),
    'plugins:router-logout': () => routerLogout(),
    'plugins:router-auth-status': () => routerAuthStatus(),
    'plugins:router-open-oauth': async () => { await shell.openExternal('http://127.0.0.1:20128/dashboard/providers') },
    'plugins:router-edit-provider': (id, input) => catalog.edit(id, input),
    'plugins:router-custom-provider': input => catalog.custom(input),
    'plugins:router-model-enabled': (provider, model, enabled) => catalog.modelEnabled(provider, model, enabled),
    'plugins:router-providers': () => catalog.providers(),
    'plugins:router-models': () => catalog.models(),
    'plugins:router-add-provider': input => catalog.add(input),
    'plugins:router-toggle-provider': (id, active) => catalog.toggle(id, active),
    'plugins:router-remove-provider': id => catalog.remove(id),
    'plugins:router-test-provider': id => catalog.test(id),
    'plugins:router-model-alias': (model, alias) => catalog.alias(model, alias),
    'plugins:router-state': () => router.state(),
    'plugins:router-control': (action) => router.control(action),
    'plugins:router-keys': () => routerKeys(),
    'plugins:router-create-key': (name) => routerCreateKey(name),
    'plugins:health': () => routerHealth(),
    'plugins:operation': () => plugins.operation(),
    'plugins:mutate': (action: PluginAction, version?: string) => plugins.mutate(action, version),
    'updates:status': () => updates.snapshot(),
    'updates:check': () => updates.check(),
    'updates:download': () => updates.download(),
    'updates:install': () => updates.install(),
    'sessions:list': () => {
      rendererReady = true
      setImmediate(flushFolders)
      return sessions.list()
    },
    'sessions:create': (cwd?: string) => {
      if (packages.operation().status === 'running') throw new Error('Wait for the package operation to finish before starting sessions.')
      if (sessions.list().length >= 32) throw new Error('MVP supports up to 32 sessions per workspace')
      const target = cwd === undefined ? folder : cwd
      if (typeof target !== 'string' || !statSync(target).isDirectory()) throw new Error('Working directory is not a folder')
      return sessions.create(target)
    },
    'sessions:snapshot': (id: string) => sessions.snapshot(id),
    'sessions:input': (id: string, data: string) => sessions.input(id, data),
    'sessions:resize': (id: string, cols: number, rows: number) => sessions.resize(id, cols, rows),
    // The renderer confirms destructive closes using the Shumora dialog.
    'sessions:close': (id: string) => {
      sessions.close(id)
      return true
    },
    'sessions:stop': (id: string) => sessions.stop(id),
    'sessions:restart': (id: string) => {
      if (packages.operation().status === 'running') throw new Error('Wait for the package operation to finish before starting sessions.')
      return sessions.restart(id)
    },
    'git:status': (id: string) => git.status(sessionCwd(id)),
    'git:diff': (id: string, file: string, area) => git.diff(sessionCwd(id), file, area),
    'git:stage': (id: string, file: string) => git.stage(sessionCwd(id), file),
    'git:unstage': (id: string, file: string) => git.unstage(sessionCwd(id), file),
    'git:stage-all': (id: string) => git.stageAll(sessionCwd(id)),
    'git:unstage-all': (id: string) => git.unstageAll(sessionCwd(id)),
    'git:discard': (id: string, file: string) => git.discard(sessionCwd(id), file),
    'git:commit': (id: string, message: string) => git.commit(sessionCwd(id), message),
    'git:commit-models': () => routerChatModels(),
    'git:generate-message': async (id: string, model: string) =>
      generateCommitMessage(model, await git.commitContext(sessionCwd(id))),
    'git:branches': (id: string) => git.branches(sessionCwd(id)),
    'git:switch': (id: string, branch: string, options: unknown) => {
      const o = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>
      return git.switchBranch(sessionCwd(id), branch, {
        create: o.create === true,
        stash: o.stash === true,
      })
    },
    'sessions:rename': (id: string, name: string) => sessions.rename(id, name),
    'workspace:folder': () => folder,
    'workspace:choose-folder': async (defaultPath?: string) => {
      if (defaultPath !== undefined && typeof defaultPath !== 'string') throw new Error('Invalid directory')
      const result = await dialog.showOpenDialog(window!, { title: 'Folder for new Pi session', defaultPath: defaultPath || folder, properties: ['openDirectory'] })
      return result.canceled ? null : result.filePaths[0] || null
    }
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted IPC sender')
      return handler(...args)
    })
  }
}

function createWindow() {
  closing = false
  window = new BrowserWindow({
    width: 1360, height: 860, minWidth: 800, minHeight: 540,
    title: 'Shumora', backgroundColor: '#ffffff', autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  })
  rendererReady = false
  window.webContents.on('did-start-loading', () => { rendererReady = false })
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url)
      if (target.protocol === 'https:' && !target.username && !target.password) void shell.openExternal(target.href).catch(() => {})
    } catch { /* Invalid external URLs are never opened. */ }
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.on('close', (event) => {
    if (closing) return
    if (!sessions.list().some((s) => s.status === 'running')) { sessions.dispose(); return }
    event.preventDefault()
    const choice = dialog.showMessageBoxSync(window!, {
      type: 'warning', title: 'Close Shumora?', message: 'Stop all running Pi sessions and close?',
      detail: 'Hidden sessions are still running. Closing this app stops their processes. Conversation resume is not managed by this MVP.',
      buttons: ['Keep working', 'Stop sessions and close'], defaultId: 0, cancelId: 0
    })
    if (choice === 1) { closing = true; sessions.dispose(); window?.close() }
  })
  window.on('closed', () => { window = undefined })
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

if (primaryInstance) app.whenReady().then(async () => {
  nativeTheme.themeSource = 'system'
  nativeTheme.on('updated', () => {
    if (window && !window.isDestroyed()) window.webContents.send('appearance:system-theme', nativeTheme.shouldUseDarkColors)
  })
  await bridge.listen()
  database = openDatabase(app.getPath('userData'))
  plugins = new PluginService(database, pluginHost, operation => {
    if (window && !window.isDestroyed()) window.webContents.send('plugins:operation', operation)
  })
  piPlugin = new PluginService(database, piPluginHost, operation => {
    if (window && !window.isDestroyed()) window.webContents.send('pi-plugin:operation', operation)
  }, piDefinition, () => { if (sessions.list().some(s => s.status === 'running')) throw new Error('Stop all running Workspace sessions before changing Pi.') })
  const unsupported = !app.isPackaged ? 'Updates can only be installed in a packaged Shumora application.'
    : process.platform === 'darwin' ? 'macOS automatic updates require a signed and notarized release. Install a release manually for now.'
    : process.platform === 'linux' && !process.env.APPIMAGE ? 'Linux automatic updates are supported only for AppImage installations.'
    : !['linux', 'win32'].includes(process.platform) ? 'Automatic updates are not supported on this platform.' : undefined
  updates = new UpdateManager(autoUpdater, app.getVersion(), state => {
    if (window && !window.isDestroyed()) window.webContents.send('updates:state', state)
  }, () => {
    for (const session of sessions.list()) sessions.stop(session.id)
    closing = true
  }, unsupported)
  registerIPC()
  folder = openFolderArgument(process.argv) || folder
  sessions.create(folder)
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { sessions.dispose(); app.quit() })
app.on('before-quit', (event) => {
  if (routerClosing) return
  event.preventDefault()
  void router.dispose().catch(() => {}).finally(() => { routerClosing = true; app.quit() })
})
let routerClosing = false
app.on('will-quit', () => { meetings.stop(); bridge.dispose(); sessions.dispose(); database?.close(); database = undefined })
