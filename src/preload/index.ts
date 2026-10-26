import { contextBridge, ipcRenderer } from 'electron'
import type { PluginsAPI, PluginOperation } from '../shared/plugins'
import type { UpdatesAPI, UpdateState } from '../shared/updates'
import type { WorkspaceAPI, SessionEvent } from '../shared/types'
const api: WorkspaceAPI = {
  list: () => ipcRenderer.invoke('sessions:list'),
  create: () => ipcRenderer.invoke('sessions:create'),
  snapshot: (id) => ipcRenderer.invoke('sessions:snapshot', id),
  input: (id, data) => ipcRenderer.invoke('sessions:input', id, data),
  resize: (id, cols, rows) => ipcRenderer.invoke('sessions:resize', id, cols, rows),
  close: (id) => ipcRenderer.invoke('sessions:close', id),
  stop: (id) => ipcRenderer.invoke('sessions:stop', id),
  restart: (id) => ipcRenderer.invoke('sessions:restart', id),
  folder: () => ipcRenderer.invoke('workspace:folder'),
  chooseFolder: () => ipcRenderer.invoke('workspace:choose-folder'),
  onEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SessionEvent) => callback(data)
    ipcRenderer.on('sessions:event', listener)
    return () => ipcRenderer.removeListener('sessions:event', listener)
  }
}
contextBridge.exposeInMainWorld('workspace', api)
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
