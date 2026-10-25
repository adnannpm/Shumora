export interface RouterPlugin {
  id: '9router'
  name: string
  description: string
  repository: string
  installed: boolean
  installedVersion?: string
  executable?: string
  latestVersion?: string
  changelog?: string
  checkedAt: string
  error?: string
  busy: boolean
  operationError?: string
}
export type PluginAction = 'install' | 'update' | 'uninstall'
export interface PluginsAPI {
  status(refresh?: boolean): Promise<RouterPlugin>
  mutate(action: PluginAction, version?: string): Promise<RouterPlugin>
}
declare global { interface Window { plugins: PluginsAPI } }
