import { useEffect, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import { DataSkeleton } from './DataSkeleton'
import type { RouterConnection, RouterModel } from '../../shared/plugins'

function catalogError(error: unknown, fallback: string): string {
  // Only expose known, credential-free API diagnostics, never raw server bodies or tokens.
  const message = error instanceof Error ? error.message : ''
  if (message.includes('requires dashboard login')) return '9router requires dashboard login. Use “Sign in to 9router” in the header, then retry. Your browser login is separate.'
  if (message.includes('Unsupported disabled models response')) return 'This 9router version returned an unsupported disabled-model response.'
  if (message.includes('Unsupported model response')) return 'This 9router version returned an unsupported model response.'
  return fallback
}

export function RouterProviders() {
  const [connections, setConnections] = useState<RouterConnection[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('openai')
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [target, setTarget] = useState<RouterConnection>()
  const [editing, setEditing] = useState<RouterConnection>()
  const [editName, setEditName] = useState('')
  const [editKey, setEditKey] = useState('')
  const [customName, setCustomName] = useState('')
  const [prefix, setPrefix] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [customType, setCustomType] = useState<'openai-compatible' | 'anthropic-compatible'>('openai-compatible')
  const [apiType, setApiType] = useState<'chat' | 'responses'>('chat')
  async function refresh() { setConnections(await window.plugins.routerProviders()) }
  async function execute(work: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice('')
    try { await work(); await refresh() } catch (e) { setError(catalogError(e, 'Provider operation failed. Check that 9router is online and the provider configuration is valid.')) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    void execute(async () => {})
    const focus = () => { void execute(async () => {}) }
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [])
  return <section className="router-catalog"><div className="router-catalog-heading"><div><h2>Providers</h2><p>Connections configured in your local 9router instance.</p></div><Button variant="outline" disabled={busy} onClick={() => void execute(async () => {})}>Refresh providers</Button></div>
    {error && <p className="plugin-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <input className="router-search" aria-label="Search providers" placeholder="Search connections…" value={search} onChange={e => setSearch(e.target.value)} />
    {busy && !connections.length && <DataSkeleton label="Loading providers" shape="providers" />}
    <div className="router-catalog-grid">{connections.filter(c => `${c.name} ${c.provider}`.toLowerCase().includes(search.toLowerCase())).map(c => <article className="router-overview-card" key={c.id}><h3>{c.name}</h3><p>{c.provider} · {c.active ? 'Enabled' : 'Disabled'} · {c.status}</p><div className="router-control-actions"><Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditing(c); setEditName(c.name); setEditKey('') }}>Edit {c.name}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void execute(async () => { const valid = await window.plugins.routerTestProvider(c.id); setNotice(`${c.name}: ${valid ? 'Connection valid' : 'Connection test failed'}`) })}>Test {c.name}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void execute(() => window.plugins.routerToggleProvider(c.id, !c.active))}>{c.active ? 'Disable' : 'Enable'} {c.name}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setTarget(c)}>Delete {c.name}</Button></div></article>)}</div>
    {!busy && !connections.length && !error && <p>No provider connections yet.</p>}
    <section className="router-overview-card"><h3>Add API-key connection</h3><p>Use an API-key provider ID supported by your 9router version. For custom endpoints, create a node below and use its returned provider ID. OAuth account login is available through the official dashboard below.</p><form className="router-provider-form" onSubmit={e => { e.preventDefault(); void execute(async () => { await window.plugins.routerAddProvider({ provider, name, apiKey: key }); setKey(''); setName('') }) }}><label>Provider ID<input required value={provider} onChange={e => setProvider(e.target.value)} placeholder="openai" /></label><label>Connection name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label><label>Provider API key<input required type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" /></label><Button type="submit" variant="outline" disabled={busy || !provider.trim() || !name.trim() || !key.trim()}>Add connection</Button></form></section>
    <section className="router-overview-card"><h3>OAuth accounts</h3><p>Sign in with the official local 9router dashboard in your browser. It handles each provider's callback, device code and account permissions. Connections refresh when you return to Shumora.</p><Button variant="outline" disabled={busy} onClick={() => void execute(async () => { await window.plugins.routerOpenOAuth(); setNotice('In the browser, select your provider and complete Connect / Login. Return here to see the saved account.') })}>Connect OAuth account in browser</Button></section>
    <section className="router-overview-card"><h3>Custom endpoint</h3><p>Create an OpenAI- or Anthropic-compatible provider node. Credentials are added separately using the generated provider ID.</p><form className="router-provider-form" onSubmit={e => { e.preventDefault(); void execute(async () => { const id = await window.plugins.routerCustomProvider({ name: customName, prefix, baseUrl, type: customType, apiType }); setProvider(id); setName(customName); setNotice(`Endpoint created. Provider ID: ${id}. Add its connection using the API-key form above.`); setBaseUrl(''); setPrefix(''); setCustomName('') }) }}><label>Endpoint name<input required value={customName} onChange={e => setCustomName(e.target.value)} /></label><label>Model prefix<input required pattern="[a-zA-Z0-9_-]+" value={prefix} onChange={e => setPrefix(e.target.value)} /></label><label>Base URL<input required type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://example.com/v1" /></label><label>API format<select value={customType} onChange={e => setCustomType(e.target.value as typeof customType)}><option value="openai-compatible">OpenAI compatible</option><option value="anthropic-compatible">Anthropic compatible</option></select></label>{customType === 'openai-compatible' && <label>OpenAI API type<select value={apiType} onChange={e => setApiType(e.target.value as typeof apiType)}><option value="chat">Chat Completions</option><option value="responses">Responses</option></select></label>}<Button variant="outline" type="submit" disabled={busy}>Create endpoint</Button></form></section>
    <Dialog.Root open={!!editing} onOpenChange={({ open }) => { if (!open && !busy) { setEditing(undefined); setEditKey('') } }} placement="center"><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>Edit connection</Dialog.Title></Dialog.Header><Dialog.Body><form id="router-edit-connection" className="router-provider-form" onSubmit={e => { e.preventDefault(); void execute(async () => { await window.plugins.routerEditProvider(editing!.id, { name: editName, ...(editKey ? { apiKey: editKey } : {}) }); setEditing(undefined); setEditKey('') }) }}><label>Connection name<input required value={editName} onChange={e => setEditName(e.target.value)} /></label><label>Replacement API key (optional)<input type="password" autoComplete="off" value={editKey} onChange={e => setEditKey(e.target.value)} /></label><p>Leave the key empty to keep existing credentials. OAuth tokens are not edited here.</p></form></Dialog.Body><Dialog.Footer><Button disabled={busy} variant="outline" onClick={() => { setEditing(undefined); setEditKey('') }}>Cancel</Button><Button disabled={busy || !editName.trim()} variant="outline" form="router-edit-connection" type="submit">Save connection</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
    <Dialog.Root open={!!target} onOpenChange={({ open }) => { if (!open && !busy) setTarget(undefined) }} placement="center" role="alertdialog"><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>Delete {target?.name}?</Dialog.Title></Dialog.Header><Dialog.Body>This removes the saved connection from 9router. Tools using it may stop working.</Dialog.Body><Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => setTarget(undefined)}>Cancel</Button><Button colorPalette="red" disabled={busy} onClick={() => { const id = target!.id; void execute(async () => { await window.plugins.routerRemoveProvider(id); setTarget(undefined) }) }}>Confirm delete</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </section>
}
function ModelRow({ model, disabled, save, copy, toggle }: { model: RouterModel; disabled: boolean; save: (model: string, alias: string) => void; copy: (model: string) => void; toggle: () => void }) {
  const [alias, setAlias] = useState(model.alias)
  useEffect(() => setAlias(model.alias), [model.alias])
  return <article className="router-overview-card"><h3>{model.name}</h3><p>{model.provider} · {model.enabled === false ? 'Disabled' : 'Enabled'}</p><Button size="sm" variant="outline" disabled={disabled} onClick={toggle}>{model.enabled === false ? 'Enable' : 'Disable'} {model.name}</Button><div className="router-endpoint"><code>{model.id}</code><Button size="sm" variant="ghost" onClick={() => copy(model.id)}>Copy model ID</Button></div><form className="router-control-actions" onSubmit={e => { e.preventDefault(); save(model.id, alias) }}><input aria-label={`Alias for ${model.name}`} value={alias} maxLength={200} onChange={e => setAlias(e.target.value)} /><Button size="sm" variant="outline" type="submit" aria-label={`Save alias for ${model.name}`} disabled={disabled || !alias.trim() || alias === model.alias}>Save alias</Button></form></article>
}
export function RouterModels() {
  const [models, setModels] = useState<RouterModel[]>([])
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function refresh() { setModels(await window.plugins.routerModels()) }
  async function execute(work: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await work(); await refresh() } catch (e) { setError(catalogError(e, 'Cannot load or update models. Check the 9router connection and try again.')) }
    finally { setBusy(false) }
  }
  useEffect(() => { void execute(async () => {}) }, [])
  async function copy(id: string) { try { await navigator.clipboard.writeText(id); setNotice('Model ID copied') } catch { setNotice('Could not copy model ID') } }
  const filtered = models.filter(m => (!provider || m.provider === provider) && `${m.name} ${m.id} ${m.alias}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="router-catalog"><div className="router-catalog-heading"><div><h2>Models</h2><p>9router model catalog and routing aliases. Catalog entries do not guarantee an available provider connection.</p></div><Button variant="outline" disabled={busy} onClick={() => void execute(async () => {})}>Refresh models</Button></div>{error && <p className="plugin-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<div className="router-control-actions"><input aria-label="Search models" placeholder="Search model or alias…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filter by provider" value={provider} onChange={e => setProvider(e.target.value)}><option value="">All providers</option>{[...new Set(models.map(m => m.provider))].sort().map(p => <option key={p}>{p}</option>)}</select></div>{busy && !models.length ? <DataSkeleton label="Loading models" shape="models" /> : <p>{filtered.length} models</p>}<div className="router-catalog-grid">{filtered.slice(0, 100).map(model => <ModelRow key={model.id} model={model} disabled={busy} toggle={() => void execute(() => window.plugins.routerModelEnabled(model.providerAlias, model.modelId, !model.enabled))} copy={id => void copy(id)} save={(id, alias) => void execute(() => window.plugins.routerModelAlias(id, alias))} />)}</div>{filtered.length > 100 && <p>Showing the first 100 results. Narrow your search to find more models.</p>}{!busy && !filtered.length && !error && <p>No matching models.</p>}</section>
}
