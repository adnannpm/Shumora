import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import Markdown from 'react-markdown'
import type { PluginAction, PluginOperation, RouterPlugin, PluginMetadata } from '../../shared/plugins'
import thumbnail from './assets/9router-thumbnail.png'
import { DataSkeleton } from './DataSkeleton'
export function PiCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage()
  const [plugin, setPlugin] = useState<PluginMetadata<'pi'>>()
  const [checking, setChecking] = useState(true)
  useEffect(() => { void (async () => { try { setPlugin(await window.piPlugin?.status()) } finally { setChecking(false) } })().catch(() => {}) }, [])
  return <button className="plugin-card" aria-label={t("Open Pi plugin")} onClick={onOpen}><span className="pi-plugin-art" aria-hidden="true">π</span><span className="plugin-card-content"><strong>{t("Pi")}</strong><span>{t("An extensible terminal coding agent used by Shumora workspaces.")}</span><small>{checking ? <DataSkeleton label={t("Loading Pi installation")} rows={1} /> : plugin?.error || !plugin ? t("Installation status unavailable") : plugin.installed ? t("Installed · {version}", { version: plugin.installedVersion || "" }) : t("Not installed")}</small></span></button>
}
export function RouterCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage()
  const [plugin, setPlugin] = useState<RouterPlugin>()
  const [checking, setChecking] = useState(true)
  useEffect(() => { void (async () => { try { setPlugin(await window.plugins?.status()) } catch { /* Display unavailable instead of loading forever. */ } finally { setChecking(false) } })() }, [])
  return <button className="plugin-card" onClick={onOpen} aria-label={t("Open 9router plugin")}>
    <img src={thumbnail} alt={t("9router dashboard preview")} />
    <span className="plugin-card-content"><strong>{t("9router")}</strong><span>{t("A self-hosted AI gateway for coding tools, with provider routing, automatic fallback, and quota tracking.")}</span><small>{plugin ? plugin.error ? t("Installation status unavailable") : plugin.installed ? t("Installed · {version}", { version: plugin.installedVersion || "" }) : t("Not installed") : checking ? <DataSkeleton label={t("Loading installation status")} rows={1} /> : t("Installation status unavailable")}</small></span>
  </button>
}
export function RouterDetails({ onBack, onStatus, pi = false }: { onBack?: () => void; onStatus?: (plugin: RouterPlugin) => void; pi?: boolean }) {
  const { t } = useLanguage()
  const api = pi ? window.piPlugin : window.plugins
  const name = pi ? 'Pi' : '9router'
  const packageName = pi ? '@earendil-works/pi-coding-agent' : '9router'
  const [plugin, setPlugin] = useState<PluginMetadata<'pi' | '9router'>>()
  function update(value: PluginMetadata<'pi' | '9router'>) { setPlugin(ownsOperation.current ? value : { ...value, operationError: undefined }); if (value.id === '9router') onStatus?.(value as RouterPlugin) }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<PluginAction | null>(null)
  const [progress, setOperation] = useState<PluginOperation>({ status: 'idle', output: '' })
  const operation = progress
  const ownsOperation = useRef(false)
  const [copyMessage, setCopyMessage] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)
  const followOutput = useRef(true)
  const running = busy || operation.status === 'running'
  // Installation output starts collapsed and opens automatically once an operation begins,
  // so idle Library browsing is not dominated by an empty log panel.
  const [logsOpen, setLogsOpen] = useState(false)
  useEffect(() => { if (operation.status !== 'idle') setLogsOpen(true) }, [operation.status])
  useEffect(() => {
    let active = true
    const off = api?.onOperation?.(value => { if (active && ownsOperation.current) setOperation(value) })
    return () => { active = false; off?.() }
  }, [])
  useEffect(() => {
    if (followOutput.current && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [operation.output])
  async function copyLog() {
    try { await navigator.clipboard.writeText(operation.output); setCopyMessage('Copied') }
    catch { setCopyMessage('Could not copy. Select the output and copy manually.') }
  }
  async function refresh() {
    setBusy(true); setError('')
    try { if (!api) throw new Error('Restart Shumora to load the plugin bridge.'); update(await api.status(true)) } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function apply() {
    if (!action || running) return
    const requested = action
    ownsOperation.current = true
    setAction(null); setBusy(true); setError(''); setCopyMessage('')
    followOutput.current = true
    setOperation({ status: 'running', output: '[Shumora] Starting operation…\n' })
    outputRef.current?.scrollIntoView?.({ block: 'nearest' })
    try { update(await api.mutate(requested, plugin?.latestVersion)) } catch (e) {
      setError('Plugin operation failed. See Installation Output below for details.')
      setOperation(previous => ({ status: 'failed', output: `${previous.output}\n${String(e)}\n`.slice(-100_000) }))
    } finally { setBusy(false) }
  }
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar router-toolbar">
      <div className="router-heading">{onBack && <Button size="sm" variant="ghost" aria-label={t("Back to plugins")} title={t("Back to plugins")} onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg></Button>}<h1>{name} {t("plugin")}</h1></div>
      <Button size="sm" variant="ghost" aria-label={t("Refresh status")} title={t("Refresh status")} disabled={running} onClick={() => void refresh()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17" /></svg></Button>
    </header>
    <div className="router-details">
      {pi ? <div className="plugin-detail-media pi-plugin-art" aria-label={t("Pi terminal coding agent")}>π</div> : <div className="plugin-detail-media"><img src={thumbnail} alt={t("Official 9router dashboard screenshot")} /></div>}
      <h2>{name}</h2><p>{plugin?.description || (pi ? t("An extensible terminal coding agent used by Shumora workspaces.") : t("A self-hosted AI gateway connecting coding tools to multiple model providers."))}</p>
      <p className="plugin-attribution package-sources"><a href={pi ? "https://github.com/earendil-works/pi" : "https://github.com/decolua/9router"} target="_blank" rel="noopener noreferrer">{t("Repository")}</a><a href={`https://www.npmjs.com/package/${packageName}`} target="_blank" rel="noopener noreferrer">{t("npm")}</a><span>{t("MIT ·")} {pi ? t("Pi contributors") : t("decolua and contributors")}</span></p>
      {!plugin && !error ? <DataSkeleton label={t("Loading plugin details")} shape="details" rows={3} /> : <dl className="settings-details"><div><dt>{t("Installation")}</dt><dd>{!plugin ? t("Checking…") : plugin.error?.startsWith('Cannot verify local') ? t("Unverified") : plugin.installed ? t("Installed") : t("Not installed")}</dd></div><div><dt>{t("Installed version")}</dt><dd>{plugin?.installedVersion || '—'}</dd></div><div><dt>{t("Latest npm version")}</dt><dd>{plugin?.latestVersion || t("Unavailable")}</dd></div>{plugin?.executable && <div><dt>{t("Executable")}</dt><dd>{plugin.executable}</dd></div>}</dl>}
      {(error || plugin?.error || plugin?.operationError) && <p className="plugin-error" role="alert">{error || (plugin?.operationError ? t("Plugin operation failed. See Installation Output below for details.") : plugin?.error)}</p>}
      <p className="settings-note">{pi ? t("Pi powers Workspace sessions. Stop all running sessions before changing Pi. Only the active npm global installation is managed; Bun and standalone installations must be managed manually. No sudo or elevation is used.") : t("Only the npm installation visible on PATH is managed. Installed does not mean running. Docker/source installations and starting the 9router service are not managed here. No sudo or privilege elevation is used.")}</p>
      {plugin?.operationError && <div className="release-notes"><h3>{t("Manual commands")}</h3><p>{t("Run these yourself in a terminal with the appropriate permissions. Shumora does not request elevation.")}</p><pre><code>{`npm install -g --ignore-scripts ${packageName}@${plugin.latestVersion || '<version>'}\n# To remove instead:\nnpm uninstall -g ${packageName}`}</code></pre></div>}
      <h3>{t("Changelog")}{plugin?.latestVersion ? ` · ${plugin.latestVersion}` : ''}</h3>
      <div className="release-notes">{!plugin && !error ? <DataSkeleton label={t("Loading changelog")} rows={5} /> : <Markdown skipHtml components={{ a: ({ children, href }) => <span>{children}{href ? ` (${href})` : ''}</span>, img: ({ alt }) => <span>{alt}</span> }}>{plugin?.changelog || t("Refresh to load release notes from the official repository.")}</Markdown>}</div>
      <section className="plugin-output" aria-label={t("Installation output")}>
        <div className="plugin-output-header"><strong>{t("Installation Output")}</strong><span className={`plugin-output-status ${operation.status}`} role="status">{{ idle: t("Ready"), running: t("Running"), success: t("Success"), failed: t("Failed") }[operation.status]}</span><Button size="xs" variant="ghost" disabled={!operation.output} onClick={() => void copyLog()}>{t("Copy log")}</Button><Button size="xs" variant="ghost" aria-expanded={logsOpen} onClick={() => setLogsOpen(value => !value)}>{logsOpen ? t("Hide output") : t("Show output")}</Button></div>
        <div className="plugin-output-body" hidden={!logsOpen}>
          <pre ref={outputRef} className="plugin-output-log" role="log" aria-label={t("npm operation output")} aria-live="off" tabIndex={0} onScroll={event => { const el = event.currentTarget; followOutput.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24 }}>{operation.output || t("Installation, update and uninstall output will appear here. This panel is read-only.")}</pre>
          {copyMessage && <p className="plugin-copy-status" role="status">{t(copyMessage)}</p>}
        </div>
      </section>
    </div>
    <footer className="plugin-detail-footer" aria-label={t("Plugin actions")}>
      <span className="plugin-action-status" role="status">{running ? t("Checking or applying plugin changes…") : plugin?.installed ? t("Installed · {version}", { version: plugin.installedVersion || t("Unknown version") }) : plugin ? t("Not installed") : t("Loading plugin…")}</span>
      <div className="plugin-footer-buttons">
        {plugin && !plugin.installed && <Button className="library-primary-action" colorPalette="brand" disabled={running || !plugin.latestVersion || !!plugin.error} onClick={() => setAction('install')}>{t("Install")}</Button>}
        {plugin?.installed && <><Button variant="outline" colorPalette="red" disabled={running} onClick={() => setAction('uninstall')}>{t("Uninstall")}</Button><Button className="library-primary-action" colorPalette="brand" disabled={running || !plugin.latestVersion || plugin.installedVersion === plugin.latestVersion || !!plugin.error} onClick={() => setAction('update')}>{t("Update")}</Button></>}
      </div>
    </footer>
    <Dialog.Root open={action !== null} role="alertdialog" placement="center" size="md" closeOnInteractOutside={false} onOpenChange={({ open }) => { if (!open && !busy) setAction(null) }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="library-dialog">
        <Dialog.Header><Dialog.Title>{action === 'uninstall' ? t('Uninstall {name}?', { name }) : t(action === 'update' ? 'Update {name} {version}?' : 'Install {name} {version}?', { name, version: plugin?.latestVersion || '' })}</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>{t("This changes your system npm global installation.")} {action === 'uninstall' ? t('Other tools using {name} may be affected. Running services are not stopped automatically.', { name }) : t("The exact displayed npm version will be installed. Package lifecycle scripts are disabled; optional setup may need to be completed manually.")} {t("Root-owned installations may require you to run the command yourself.")}</Dialog.Description></Dialog.Body>
        <Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>{t("Cancel")}</Button><Button className={action === 'uninstall' ? "library-danger-action" : "library-primary-action"} colorPalette={action === 'uninstall' ? "red" : "brand"} loading={busy} disabled={busy} onClick={() => void apply()}>{t("Confirm")} {t(action === 'uninstall' ? 'uninstall' : action === 'update' ? 'update' : 'install')}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </main>
}
