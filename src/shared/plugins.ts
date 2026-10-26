export interface PluginMetadata<Id extends '9router' | 'pi' = '9router'> {
  id: Id
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
export type RouterPlugin = PluginMetadata<'9router'>
export type PiPlugin = PluginMetadata<'pi'>
export interface PiPluginAPI {
  status(refresh?: boolean): Promise<PiPlugin>
  mutate(action: PluginAction, version?: string): Promise<PiPlugin>
  operation(): Promise<PluginOperation>
  onOperation(callback: (operation: PluginOperation) => void): () => void
}
declare global { interface Window { piPlugin: PiPluginAPI } }
export type PluginAction = 'install' | 'update' | 'uninstall'
export interface PluginOperation {
  status: 'idle' | 'running' | 'success' | 'failed'
  output: string
}
export type RouterControl = 'start' | 'stop' | 'restart'
export interface RouterState { online: boolean; managed: boolean; busy: boolean; logs: string }
export interface RouterKey { id: string; name: string; key: string }
export interface RouterConnection { id: string; provider: string; name: string; active: boolean; status: string }
export interface RouterModel { id: string; provider: string; name: string; alias: string; enabled: boolean; providerAlias: string; modelId: string }
export interface RouterCustomInput { name: string; prefix: string; baseUrl: string; type: 'openai-compatible' | 'anthropic-compatible'; apiType: 'chat' | 'responses' }
export interface RouterProviderInput { provider: string; name: string; apiKey: string }
export interface PluginsAPI {
  routerLogin(password: string): Promise<void>
  routerLogout(): Promise<void>
  routerAuthStatus(): Promise<{ authenticated: boolean; required: boolean }>
  routerEditProvider(id: string, input: { name: string; apiKey?: string }): Promise<void>
  routerCustomProvider(input: RouterCustomInput): Promise<string>
  routerModelEnabled(provider: string, model: string, enabled: boolean): Promise<void>
  routerOpenOAuth(): Promise<void>
  routerProviders(): Promise<RouterConnection[]>
  routerModels(): Promise<RouterModel[]>
  routerAddProvider(input: RouterProviderInput): Promise<void>
  routerToggleProvider(id: string, active: boolean): Promise<void>
  routerRemoveProvider(id: string): Promise<void>
  routerTestProvider(id: string): Promise<boolean>
  routerModelAlias(model: string, alias: string): Promise<void>
  routerState(): Promise<RouterState>
  routerControl(action: RouterControl): Promise<RouterState>
  routerKeys(): Promise<RouterKey[]>
  routerCreateKey(name: string): Promise<RouterKey>
  health(): Promise<boolean>
  operation(): Promise<PluginOperation>
  onOperation(callback: (operation: PluginOperation) => void): () => void
  status(refresh?: boolean): Promise<RouterPlugin>
  mutate(action: PluginAction, version?: string): Promise<RouterPlugin>
}
declare global { interface Window { plugins: PluginsAPI } }
