import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import * as pty from 'node-pty'
import { SessionManager } from './sessions'
import { resolveLaunch } from './launch'

let window: BrowserWindow | undefined
let folder = homedir()
let closing = false
const sessions = new SessionManager((cwd) => {
  if (!statSync(cwd).isDirectory()) throw new Error('Working directory is not a folder')
  const launch = resolveLaunch(process.platform, process.env, process.env.PATH || process.env.Path || '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE')) as Record<string, string>
  return pty.spawn(launch.file, launch.args, { name: 'xterm-256color', cols: 100, rows: 30, cwd, env: { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } })
}, (event) => {
  if (window && !window.isDestroyed()) window.webContents.send('sessions:event', event)
})

function registerIPC() {
  const handlers: Record<string, (...args: any[]) => unknown> = {
    'sessions:list': () => sessions.list(),
    'sessions:create': () => {
      if (sessions.list().length >= 32) throw new Error('MVP supports up to 32 sessions per workspace')
      return sessions.create(folder)
    },
    'sessions:snapshot': (id: string) => sessions.snapshot(id),
    'sessions:input': (id: string, data: string) => sessions.input(id, data),
    'sessions:resize': (id: string, cols: number, rows: number) => sessions.resize(id, cols, rows),
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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
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
  registerIPC()
  sessions.create(folder)
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { sessions.dispose(); app.quit() })
app.on('will-quit', () => sessions.dispose())
