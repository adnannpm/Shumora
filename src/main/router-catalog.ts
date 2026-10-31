import { routerFetch } from './router-auth'
import type { RouterConnection, RouterModel, RouterProviderInput, RouterCustomInput } from '../shared/plugins'
async function request(path: string, method = 'GET', body?: object) {
  const response = await routerFetch(path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  if (response.status === 401 || response.status === 403) throw new Error('9router requires dashboard login. Sign in from the 9router header in Shumora.')
  if (!response.ok) throw new Error(`9router request failed (HTTP ${response.status}). Check the configuration in the 9router dashboard.`)
  return response.json()
}
function id(value: string) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) throw new Error('Invalid connection ID')
  return value
}
function text(value: string, label: string, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${label}`)
  return value.trim()
}
export class RouterCatalog {
  async providers(): Promise<RouterConnection[]> {
    const data = await request('providers')
    if (!Array.isArray(data.connections)) throw new Error('Unsupported provider response')
    return data.connections.map((c: any) => ({ id: String(c.id), provider: String(c.provider), name: String(c.name || c.provider), active: c.isActive === true, status: typeof c.testStatus === 'string' ? c.testStatus : 'unknown' }))
  }
  async models(): Promise<RouterModel[]> {
    const data = await request('models')
    if (!Array.isArray(data.models)) throw new Error('Unsupported model response')
    const disabled = (await request('models/disabled')).disabled
    if (!disabled || typeof disabled !== 'object' || Array.isArray(disabled)) throw new Error('Unsupported disabled models response')
    const models: RouterModel[] = data.models.filter((m: any) => typeof m.fullModel === 'string').map((m: any) => ({ id: m.fullModel, provider: String(m.provider), name: String(m.name || m.model), alias: String(m.alias || m.model), enabled: true, providerAlias: String(m.routedModel || m.fullModel).split('/')[0], modelId: String(m.model || m.fullModel.slice(m.fullModel.indexOf('/') + 1)) }))
    for (const [provider, ids] of Object.entries(disabled)) {
      if (!Array.isArray(ids)) continue
      for (const model of ids.filter((value): value is string => typeof value === 'string')) {
        const existing = models.find(m => m.providerAlias === provider && m.modelId === model)
        if (existing) existing.enabled = false
        else models.push({ id: `${provider}/${model}`, provider, name: model, alias: model, enabled: false, providerAlias: provider, modelId: model })
      }
    }
    return models
  }
  async add(input: RouterProviderInput) {
    const provider = id(input.provider), name = text(input.name, 'name'), apiKey = text(input.apiKey, 'API key', 20000)
    // The installed API may overwrite duplicate provider/name pairs; reject them first.
    if ((await this.providers()).some(c => c.provider === provider && c.name === name)) throw new Error('A connection with this provider and name already exists. Choose a different name.')
    await request('providers', 'POST', { provider, name, apiKey, allowOverwrite: false, overwrite: false })
  }
  async edit(connection: string, input: { name: string; apiKey?: string }) {
    const body: { name: string; apiKey?: string } = { name: text(input.name, 'name') }
    if (input.apiKey) body.apiKey = text(input.apiKey, 'API key', 20000)
    await request(`providers/${id(connection)}`, 'PUT', body)
  }
  async custom(input: RouterCustomInput): Promise<string> {
    const base = new URL(text(input.baseUrl, 'base URL', 2000))
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Use an HTTP(S) base URL without credentials or query parameters')
    if (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Remote providers require HTTPS. HTTP is allowed only for loopback endpoints.')
    if (!['openai-compatible', 'anthropic-compatible'].includes(input.type) || !['chat', 'responses'].includes(input.apiType)) throw new Error('Invalid endpoint type')
    const data = await request('provider-nodes', 'POST', { name: text(input.name, 'name'), prefix: id(input.prefix), baseUrl: base.toString().replace(/\/$/, ''), type: input.type, apiType: input.apiType })
    return id(data.node?.id)
  }
  private modelBusy = false
  async modelEnabled(provider: string, model: string, enabled: boolean) {
    if (this.modelBusy) throw new Error('Another model change is running')
    const providerAlias = id(provider), modelId = text(model, 'model', 500)
    if (typeof enabled !== 'boolean') throw new Error('Invalid enabled flag')
    this.modelBusy = true
    try {
      if (enabled) await request(`models/disabled?providerAlias=${encodeURIComponent(providerAlias)}&id=${encodeURIComponent(modelId)}`, 'DELETE')
      else {
        const data = await request('models/disabled')
        const previous = data.disabled?.[providerAlias] || []
        if (!Array.isArray(previous)) throw new Error('Unsupported disabled models response')
        await request('models/disabled', 'POST', { providerAlias, ids: [...new Set([...previous, modelId])] })
      }
    } finally { this.modelBusy = false }
  }
  async toggle(connection: string, active: boolean) {
    if (typeof active !== 'boolean') throw new Error('Invalid active flag')
    await request(`providers/${id(connection)}`, 'PUT', { isActive: active })
  }
  async remove(connection: string) { await request(`providers/${id(connection)}`, 'DELETE') }
  async test(connection: string): Promise<boolean> {
    const result = await request(`providers/${id(connection)}/test`, 'POST')
    return result.valid === true || result.success === true
  }
  async alias(model: string, alias: string) { await request('models', 'PUT', { model: text(model, 'model', 500), alias: text(alias, 'alias') }) }
}
