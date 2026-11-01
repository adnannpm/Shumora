import { useLanguage } from './Language'
import { useEffect, useId, useState } from 'react'
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
  const { t } = useLanguage()
  const [connections, setConnections] = useState<RouterConnection[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [addType, setAddType] = useState<'key' | 'oauth' | 'custom'>('key')
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
  const filtered = connections.filter(c => (!statusFilter || c.active === (statusFilter === "enabled")) && `${c.name} ${c.provider}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section className="router-catalog router-providers"><div className="router-catalog-heading"><div><h2>{t("Providers")}</h2><p>{t("Connections configured in your local 9router instance.")}</p></div><div className="router-provider-toolbar"><Button variant="outline" disabled={busy} onClick={() => void execute(async () => {})}>{t("Refresh providers")}</Button><Button colorPalette="brand" onClick={() => setAdding(true)}>{t("Add provider")}</Button></div></div>
    {error && <p className="plugin-error" role="alert">{t(error)}</p>}{notice && <p role="status">{t(notice)}</p>}
    <div className="router-provider-filters"><input type="search" className="router-search" aria-label={t("Search providers")} placeholder={t("Search connections…")} value={search} onChange={e => setSearch(e.target.value)} /><select aria-label={t("Connection status")} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">{t("All connections")}</option><option value="enabled">{t("Enabled")}</option><option value="disabled">{t("Disabled")}</option></select></div>
    {busy ? <DataSkeleton label={t("Loading providers")} shape="providers" /> : <div className="router-catalog-grid">{filtered.map(c => <article className="router-overview-card router-provider-card" key={c.id}><div className="router-card-heading"><div><h3>{c.name}</h3><code>{c.provider}</code></div><span className={`router-status-badge ${c.active ? "online" : "offline"}`}><span aria-hidden="true" className={`router-service-dot ${c.active ? "online" : "offline"}`} />{c.active ? t("Enabled") : t("Disabled")}</span></div><p className="router-provider-health">{t("Connection status")}: {c.status || t("Unavailable")}</p><div className="router-control-actions"><Button size="sm" variant="outline" disabled={busy} aria-label={`${t("Edit")} ${c.name}`} onClick={() => { setEditing(c); setEditName(c.name); setEditKey('') }}>{t("Edit")}</Button><Button size="sm" variant="outline" disabled={busy} aria-label={`${t("Test")} ${c.name}`} onClick={() => void execute(async () => { const valid = await window.plugins.routerTestProvider(c.id); setNotice(`${c.name}: ${valid ? 'Connection valid' : 'Connection test failed'}`) })}>{t("Test")}</Button><Button size="sm" variant="ghost" aria-label={`${c.active ? t("Disable") : t("Enable")} ${c.name}`} disabled={busy} onClick={() => void execute(() => window.plugins.routerToggleProvider(c.id, !c.active))}>{c.active ? t("Disable") : t("Enable")}</Button><Button size="sm" variant="outline" disabled={busy} aria-label={`${t("Delete")} ${c.name}`} onClick={() => setTarget(c)}>{t("Delete")}</Button></div></article>)}</div>}
    {!busy && !filtered.length && !error && <div className="router-keys-empty"><p>{t(connections.length ? "No matching connections." : "No provider connections yet.")}</p></div>}
    <Dialog.Root open={adding} onOpenChange={({ open }) => { if (!busy) { setAdding(open); if (!open) setKey('') } }} placement="center" size="lg"><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="router-add-provider"><Dialog.Header><Dialog.Title>{t('Add provider')}</Dialog.Title></Dialog.Header><Dialog.Body>
    <div className="router-provider-methods" role="group" aria-label={t('Connection method')}>{([['key', 'Add API-key connection'], ['oauth', 'OAuth accounts'], ['custom', 'Custom endpoint']] as const).map(([value, label]) => <Button key={value} variant={addType === value ? 'solid' : 'outline'} aria-pressed={addType === value} onClick={() => setAddType(value)}>{t(label)}</Button>)}</div>
    {notice && <p role="status">{t(notice)}</p>}{error && <p role="alert" className="plugin-error">{t(error)}</p>}
    {addType === 'key' && <section className="router-provider-setup"><h3>{t("Add API-key connection")}</h3><p>{t("Use an API-key provider ID supported by your 9router version. For custom endpoints, create a node below and use its returned provider ID. OAuth account login is available through the official dashboard below.")}</p><form className="router-provider-form" onSubmit={e => { e.preventDefault(); void execute(async () => { await window.plugins.routerAddProvider({ provider, name, apiKey: key }); setKey(''); setName('') }) }}><label>{t("Provider ID")}<input required value={provider} onChange={e => setProvider(e.target.value)} placeholder={t("openai")} /></label><label>{t("Connection name")}<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label><label>{t("Provider API key")}<input required type="password" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" /></label><Button type="submit" variant="outline" disabled={busy || !provider.trim() || !name.trim() || !key.trim()}>{t("Add connection")}</Button></form></section>}
{addType === 'oauth' && <section className="router-provider-setup"><h3>{t("OAuth accounts")}</h3><p>{t("Sign in with the official local 9router dashboard in your browser. It handles each provider's callback, device code and account permissions. Connections refresh when you return to Shumora.")}</p><Button variant="outline" disabled={busy} onClick={() => void execute(async () => { await window.plugins.routerOpenOAuth(); setNotice('In the browser, select your provider and complete Connect / Login. Return here to see the saved account.') })}>{t("Connect OAuth account in browser")}</Button></section>}
{addType === 'custom' && <section className="router-provider-setup"><h3>{t("Custom endpoint")}</h3><p>{t("Create an OpenAI- or Anthropic-compatible provider node. Credentials are added separately using the generated provider ID.")}</p><form className="router-provider-form" onSubmit={e => { e.preventDefault(); void execute(async () => { const id = await window.plugins.routerCustomProvider({ name: customName, prefix, baseUrl, type: customType, apiType }); setProvider(id); setName(customName); setAddType("key"); setNotice(`Endpoint created. Provider ID: ${id}. Add its connection using the API-key form above.`); setBaseUrl(''); setPrefix(''); setCustomName('') }) }}><label>{t("Endpoint name")}<input required value={customName} onChange={e => setCustomName(e.target.value)} /></label><label>{t("Model prefix")}<input required pattern="[a-zA-Z0-9_-]+" value={prefix} onChange={e => setPrefix(e.target.value)} /></label><label>{t("Base URL")}<input required type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={t("https://example.com/v1")} /></label><label>{t("API format")}<select value={customType} onChange={e => setCustomType(e.target.value as typeof customType)}><option value="openai-compatible">{t("OpenAI compatible")}</option><option value="anthropic-compatible">{t("Anthropic compatible")}</option></select></label>{customType === 'openai-compatible' && <label>{t("OpenAI API type")}<select value={apiType} onChange={e => setApiType(e.target.value as typeof apiType)}><option value="chat">{t("Chat Completions")}</option><option value="responses">{t("Responses")}</option></select></label>}<Button variant="outline" type="submit" disabled={busy}>{t("Create endpoint")}</Button></form></section>}
    </Dialog.Body><Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => { setAdding(false); setKey('') }}>{t('Close')}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
    <Dialog.Root open={!!editing} onOpenChange={({ open }) => { if (!open && !busy) { setEditing(undefined); setEditKey('') } }} placement="center"><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>{t("Edit connection")}</Dialog.Title></Dialog.Header><Dialog.Body><form id="router-edit-connection" className="router-provider-form" onSubmit={e => { e.preventDefault(); void execute(async () => { await window.plugins.routerEditProvider(editing!.id, { name: editName, ...(editKey ? { apiKey: editKey } : {}) }); setEditing(undefined); setEditKey('') }) }}><label>{t("Connection name")}<input required value={editName} onChange={e => setEditName(e.target.value)} /></label><label>{t("Replacement API key (optional)")}<input type="password" autoComplete="off" value={editKey} onChange={e => setEditKey(e.target.value)} /></label><p>{t("Leave the key empty to keep existing credentials. OAuth tokens are not edited here.")}</p></form></Dialog.Body><Dialog.Footer><Button disabled={busy} variant="outline" onClick={() => { setEditing(undefined); setEditKey('') }}>{t("Cancel")}</Button><Button disabled={busy || !editName.trim()} variant="outline" form="router-edit-connection" type="submit">{t("Save connection")}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
    <Dialog.Root open={!!target} onOpenChange={({ open }) => { if (!open && !busy) setTarget(undefined) }} placement="center" role="alertdialog"><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>{t("Delete")} {target?.name}?</Dialog.Title></Dialog.Header><Dialog.Body>{t("This removes the saved connection from 9router. Tools using it may stop working.")}</Dialog.Body><Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => setTarget(undefined)}>{t("Cancel")}</Button><Button colorPalette="red" disabled={busy} onClick={() => { const id = target!.id; void execute(async () => { await window.plugins.routerRemoveProvider(id); setTarget(undefined) }) }}>{t("Confirm delete")}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </section>
}
function ModelRow({ model, disabled, save, copy, toggle }: { model: RouterModel; disabled: boolean; save: (model: string, alias: string) => void; copy: (model: string) => void; toggle: () => void }) {
  const { t } = useLanguage()
  const [alias, setAlias] = useState(model.alias)
  const aliasId = useId()
  useEffect(() => setAlias(model.alias), [model.alias])
  return <tr>
    <th scope="row"><strong>{model.name}</strong><span className="router-model-provider">{model.provider}</span><div className="router-model-identity"><code title={model.id}>{model.id}</code><Button size="xs" variant="ghost" aria-label={`${t('Copy model ID')} ${model.name}`} onClick={() => copy(model.id)}>{t('Copy')}</Button></div></th>
    <td><span className={`router-status-badge ${model.enabled === false ? 'offline' : 'online'}`}><span aria-hidden="true" className={`router-service-dot ${model.enabled === false ? 'offline' : 'online'}`} />{model.enabled === false ? t('Disabled') : t('Enabled')}</span></td>
    <td><form className="router-model-alias-inline" onSubmit={e => { e.preventDefault(); save(model.id, alias) }}><input id={aliasId} aria-label={t('Alias for {name}', { name: model.name })} value={alias} maxLength={200} onChange={e => setAlias(e.target.value)} /><Button size="xs" variant="outline" type="submit" aria-label={t('Save alias for {name}', { name: model.name })} disabled={disabled || !alias.trim() || alias === model.alias}>{t('Save alias')}</Button></form></td>
    <td><Button size="xs" variant="ghost" aria-label={`${model.enabled === false ? t('Enable') : t('Disable')} ${model.name}`} disabled={disabled} onClick={toggle}>{model.enabled === false ? t('Enable') : t('Disable')}</Button></td>
  </tr>
}
export function RouterModels() {
  const { t } = useLanguage()
  const [models, setModels] = useState<RouterModel[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')
  const [busy, setBusy] = useState(true)
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
  const filtered = models.filter(m => (!provider || m.provider === provider) && `${m.name} ${m.id} ${m.alias}`.toLowerCase().includes(search.trim().toLowerCase()))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  return <section className="router-catalog router-models"><div className="router-catalog-heading"><div><h2>{t("Models")}</h2><p>{t("9router model catalog and routing aliases. Catalog entries do not guarantee an available provider connection.")}</p></div><Button variant="outline" disabled={busy} onClick={() => void execute(async () => {})}>{t("Refresh models")}</Button></div>{error && <p className="plugin-error" role="alert">{t(error)}</p>}{notice && <p role="status">{t(notice)}</p>}<div className="router-model-filters"><input type="search" aria-label={t("Search models")} placeholder={t("Search model or alias…")} value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /><select aria-label={t("Filter by provider")} value={provider} onChange={e => { setProvider(e.target.value); setPage(1) }}><option value="">{t("All providers")}</option>{[...new Set(models.map(m => m.provider))].sort().map(p => <option key={p}>{p}</option>)}</select></div>{busy ? <DataSkeleton label={t("Loading models")} shape="models" /> : <><p className="router-model-results" role="status" aria-label={t('Model results')}><strong>{filtered.length}</strong> {t("models")}</p>{!!filtered.length && <div className="router-model-table-scroll"><table className="router-model-table" aria-label={t("Models")}><thead><tr><th scope="col">{t("Models")}</th><th scope="col">{t("Connection status")}</th><th scope="col">{t("Routing alias")}</th><th scope="col">{t("Actions")}</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(model => <ModelRow key={model.id} model={model} disabled={busy} toggle={() => void execute(() => window.plugins.routerModelEnabled(model.providerAlias, model.modelId, !model.enabled))} copy={id => void copy(id)} save={(id, alias) => void execute(() => window.plugins.routerModelAlias(id, alias))} />)}</tbody></table></div>}<nav className="router-model-pagination" aria-label={t("Model pages")}><span>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} / {filtered.length}</span><div><Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t("Previous")}</Button><span>{t("Page")} {currentPage} {t("of")} {pages}</span><Button size="sm" variant="outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>{t("Next")}</Button></div></nav>{!busy && !filtered.length && !error && <p className="router-keys-empty">{t("No matching models.")}</p>}</>}</section>
}
