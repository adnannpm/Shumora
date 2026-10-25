import { contextBridge, ipcRenderer } from 'electron'
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
