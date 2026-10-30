import { contextBridge, ipcRenderer } from 'electron'
import type { AppearanceAPI } from '../shared/appearance'
const appearance: AppearanceAPI = {
  systemDark: () => ipcRenderer.invoke('appearance:system-dark'),
  onSystemTheme: callback => {
    const listener = (_event: Electron.IpcRendererEvent, dark: boolean) => callback(dark)
    ipcRenderer.on('appearance:system-theme', listener)
    return () => ipcRenderer.removeListener('appearance:system-theme', listener)
  }
}
contextBridge.exposeInMainWorld('appearance', appearance)
import type { DiagnosticsAPI } from '../shared/diagnostics'
const diagnostics: DiagnosticsAPI = { run: () => ipcRenderer.invoke('diagnostics:run') }
contextBridge.exposeInMainWorld('diagnostics', diagnostics)
import type { MeetingsAPI, MeetingSnapshot } from '../shared/meetings'
const meetings: MeetingsAPI = {
  snapshot: () => ipcRenderer.invoke('meetings:snapshot'),
  start: input => ipcRenderer.invoke('meetings:start', input),
  pause: () => ipcRenderer.invoke('meetings:pause'),
  resume: () => ipcRenderer.invoke('meetings:resume'),
  stop: () => ipcRenderer.invoke('meetings:stop'),
  takeOver: () => ipcRenderer.invoke('meetings:take-over'),
  direction: text => ipcRenderer.invoke('meetings:direction', text),
  onChange: callback => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: MeetingSnapshot) => callback(snapshot)
    ipcRenderer.on('meetings:change', listener)
    return () => ipcRenderer.removeListener('meetings:change', listener)
  }
}
contextBridge.exposeInMainWorld('meetings', meetings)
import type { PackageAPI } from '../shared/packages'
import type { PluginsAPI, PluginOperation, PiPluginAPI } from '../shared/plugins'
import type { UpdatesAPI, UpdateState } from '../shared/updates'
import type { WorkspaceAPI, SessionEvent, GitAskPassRequest } from '../shared/types'
const api: WorkspaceAPI = {
  notificationsEnabled: () => ipcRenderer.invoke('agents:notifications'),
  setNotificationsEnabled: enabled => ipcRenderer.invoke('agents:set-notifications', enabled),
  list: () => ipcRenderer.invoke('sessions:list'),
  create: (cwd) => ipcRenderer.invoke('sessions:create', cwd),
  snapshot: (id) => ipcRenderer.invoke('sessions:snapshot', id),
  input: (id, data) => ipcRenderer.invoke('sessions:input', id, data),
  resize: (id, cols, rows) => ipcRenderer.invoke('sessions:resize', id, cols, rows),
  close: (id) => ipcRenderer.invoke('sessions:close', id),
  stop: (id) => ipcRenderer.invoke('sessions:stop', id),
  restart: (id) => ipcRenderer.invoke('sessions:restart', id),
  rename: (id, name) => ipcRenderer.invoke('sessions:rename', id, name),
  folder: () => ipcRenderer.invoke('workspace:folder'), 
  chooseFolder: (defaultPath) => ipcRenderer.invoke('workspace:choose-folder', defaultPath),
  gitStatus: (id) => ipcRenderer.invoke('git:status', id),
  gitDiff: (id, path, area) => ipcRenderer.invoke('git:diff', id, path, area),
  gitStage: (id, path) => ipcRenderer.invoke('git:stage', id, path),
  gitUnstage: (id, path) => ipcRenderer.invoke('git:unstage', id, path),
  gitStageAll: (id) => ipcRenderer.invoke('git:stage-all', id),
  gitUnstageAll: (id) => ipcRenderer.invoke('git:unstage-all', id),
  gitDiscard: (id, path) => ipcRenderer.invoke('git:discard', id, path),
  gitCommit: (id, message) => ipcRenderer.invoke('git:commit', id, message),
  gitPush: (id, options) => ipcRenderer.invoke('git:push', id, options),
  gitPushInfo: (id, branch) => ipcRenderer.invoke('git:push-info', id, branch),
  gitCommitModels: () => ipcRenderer.invoke('git:commit-models'),
  gitGenerateMessage: (id, model) => ipcRenderer.invoke('git:generate-message', id, model),
  gitBranches: (id) => ipcRenderer.invoke('git:branches', id),
  gitSwitch: (id, branch, options) => ipcRenderer.invoke('git:switch', id, branch, options),
  onGitAskPass: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, request: GitAskPassRequest) => callback(request)
    ipcRenderer.on('git:askpass-request', listener)
    return () => ipcRenderer.removeListener('git:askpass-request', listener)
  },
  gitAskPassReply: (response) => ipcRenderer.invoke('git:askpass-reply', response),
  onEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SessionEvent) => callback(data)
    ipcRenderer.on('sessions:event', listener)
    return () => ipcRenderer.removeListener('sessions:event', listener)
  }
}
contextBridge.exposeInMainWorld('workspace', api)
const packages: PackageAPI = {
  updates: scope => ipcRenderer.invoke('packages:updates', scope),
  detail: name => ipcRenderer.invoke('packages:detail', name),
  status: name => ipcRenderer.invoke('packages:status', name),
  mutate: (action, name, version) => ipcRenderer.invoke('packages:mutate', action, name, version),
  catalog: query => ipcRenderer.invoke('packages:catalog', query),
  install: (name, version) => ipcRenderer.invoke('packages:install', name, version),
  operation: () => ipcRenderer.invoke('packages:operation'),
  onOperation: callback => {
    const listener = (_event: Electron.IpcRendererEvent, operation: PluginOperation) => callback(operation)
    ipcRenderer.on('packages:operation', listener)
    return () => ipcRenderer.removeListener('packages:operation', listener)
  }
}
contextBridge.exposeInMainWorld('packages', packages)
const plugins: PluginsAPI = {
  routerLogin: password => ipcRenderer.invoke('plugins:router-login', password),
  routerLogout: () => ipcRenderer.invoke('plugins:router-logout'),
  routerAuthStatus: () => ipcRenderer.invoke('plugins:router-auth-status'),
  routerOpenOAuth: () => ipcRenderer.invoke('plugins:router-open-oauth'),
  routerEditProvider: (id, input) => ipcRenderer.invoke('plugins:router-edit-provider', id, input),
  routerCustomProvider: input => ipcRenderer.invoke('plugins:router-custom-provider', input),
  routerModelEnabled: (provider, model, enabled) => ipcRenderer.invoke('plugins:router-model-enabled', provider, model, enabled),
  routerProviders: () => ipcRenderer.invoke('plugins:router-providers'),
  routerModels: () => ipcRenderer.invoke('plugins:router-models'),
  routerAddProvider: input => ipcRenderer.invoke('plugins:router-add-provider', input),
  routerToggleProvider: (id, active) => ipcRenderer.invoke('plugins:router-toggle-provider', id, active),
  routerRemoveProvider: id => ipcRenderer.invoke('plugins:router-remove-provider', id),
  routerTestProvider: id => ipcRenderer.invoke('plugins:router-test-provider', id),
  routerModelAlias: (model, alias) => ipcRenderer.invoke('plugins:router-model-alias', model, alias),
  routerState: () => ipcRenderer.invoke('plugins:router-state'),
  routerControl: action => ipcRenderer.invoke('plugins:router-control', action),
  routerKeys: () => ipcRenderer.invoke('plugins:router-keys'),
  routerCreateKey: name => ipcRenderer.invoke('plugins:router-create-key', name),
  health: () => ipcRenderer.invoke('plugins:health'),
  operation: () => ipcRenderer.invoke('plugins:operation'),
  onOperation: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, operation: PluginOperation) => callback(operation)
    ipcRenderer.on('plugins:operation', listener)
    return () => ipcRenderer.removeListener('plugins:operation', listener)
  },
  status: (refresh) => ipcRenderer.invoke('plugins:status', refresh),
  mutate: (action, version) => ipcRenderer.invoke('plugins:mutate', action, version)
}
contextBridge.exposeInMainWorld('plugins', plugins)
const piPlugin: PiPluginAPI = {
  status: refresh => ipcRenderer.invoke('pi-plugin:status', refresh),
  mutate: (action, version) => ipcRenderer.invoke('pi-plugin:mutate', action, version),
  operation: () => ipcRenderer.invoke('pi-plugin:operation'),
  onOperation: callback => {
    const listener = (_event: Electron.IpcRendererEvent, operation: PluginOperation) => callback(operation)
    ipcRenderer.on('pi-plugin:operation', listener)
    return () => ipcRenderer.removeListener('pi-plugin:operation', listener)
  }
}
contextBridge.exposeInMainWorld('piPlugin', piPlugin)
const updates: UpdatesAPI = {
  status: () => ipcRenderer.invoke('updates:status'),
  check: () => ipcRenderer.invoke('updates:check'),
  download: () => ipcRenderer.invoke('updates:download'),
  install: () => ipcRenderer.invoke('updates:install'),
  onState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => callback(state)
    ipcRenderer.on('updates:state', listener)
    return () => ipcRenderer.removeListener('updates:state', listener)
  }
}
contextBridge.exposeInMainWorld('updates', updates)
