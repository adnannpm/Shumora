import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import * as pty from 'node-pty'
import { SessionManager } from './sessions'
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

process.env.PATH = enrichedPath(process.platform, process.env)

let window: BrowserWindow | undefined
let folder = homedir()
let closing = false
let database: ReturnType<typeof openDatabase> | undefined
const sessions = new SessionManager((cwd) => {
  if (!statSync(cwd).isDirectory()) throw new Error('Working directory is not a folder')
  const launch = resolveLaunch(process.platform, process.env, process.env.PATH || process.env.Path || '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE')) as Record<string, string>
  return pty.spawn(launch.file, launch.args, { name: 'xterm-256color', cols: 100, rows: 30, cwd, env: { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } })
}, (event) => {
  if (window && !window.isDestroyed()) window.webContents.send('sessions:event', event)
})

let updates: UpdateManager
const packages = new PackageService(fetchPackagePage, runPiPackage, () => { if (sessions.list().some(s => s.status === 'running')) throw new Error('Stop running Workspace sessions before installing a package.') }, operation => {
  if (window && !window.isDestroyed()) window.webContents.send('packages:operation', operation)
}, packageStatus)
let plugins: PluginService
let piPlugin: PluginService<'pi'>
const router = new RouterService(routerHost)
const catalog = new RouterCatalog()
function registerIPC() {
  const handlers: Record<string, (...args: any[]) => unknown> = {
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
    'sessions:list': () => sessions.list(),
    'sessions:create': () => {
      if (sessions.list().length >= 32) throw new Error('MVP supports up to 32 sessions per workspace')
      return sessions.create(folder)
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
    'sessions:restart': (id: string) => sessions.restart(id),
    'workspace:folder': () => folder,
    'workspace:choose-folder': async () => {
      const result = await dialog.showOpenDialog(window!, { title: 'Folder for new Pi sessions', defaultPath: folder, properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths[0]) folder = result.filePaths[0]
      return folder
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
    webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  })
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

app.whenReady().then(() => {
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
app.on('will-quit', () => { sessions.dispose(); database?.close(); database = undefined })
