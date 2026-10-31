import { pluginFailureMessage } from './plugin-feedback'
import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import Markdown from 'react-markdown'
import type { PackageManager, PluginAction, PluginOperation, RouterPlugin, PluginMetadata } from '../../shared/plugins'
import thumbnail from './assets/9router-thumbnail.png'
import piThumbnail from './assets/pi-thumbnail.svg?no-inline'
import opencodeThumbnail from './assets/opencode-thumbnail.svg?no-inline'
import { DataSkeleton } from './DataSkeleton'
import { PluginDetailHeader } from './PluginDetailHeader'
import { managerPluginInfo } from './manager-plugin-info'
import type { ManagerPluginId, PluginId } from '../../shared/plugins'
export function PiCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useLanguage()
  const [plugin, setPlugin] = useState<PluginMetadata<'pi'>>()
  const [checking, setChecking] = useState(true)
  useEffect(() => { void (async () => { try { setPlugin(await window.piPlugin?.status()) } finally { setChecking(false) } })().catch(() => {}) }, [])
  return <button className="plugin-card" aria-label={t("Open Pi plugin")} onClick={onOpen}><img src={piThumbnail} alt="Pi thumbnail" /><span className="plugin-card-content"><strong>{t("Pi")}</strong><span>{t("An extensible terminal coding agent used by Shumora workspaces.")}</span><small>{checking ? <DataSkeleton label={t("Loading Pi installation")} rows={1} /> : plugin?.error || !plugin ? t("Installation status unavailable") : plugin.installed ? t("Installed · {version}", { version: plugin.installedVersion || "" }) : t("Not installed")}</small></span></button>
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
export function RouterDetails({ onBack, onStatus, pi = false, opencode = false, managerId }: { onBack?: () => void; onStatus?: (plugin: RouterPlugin) => void; pi?: boolean; opencode?: boolean; managerId?: ManagerPluginId }) {
  const { t } = useLanguage()
  const managerInfo = managerId ? managerPluginInfo[managerId] : undefined
  const api = managerId ? window.managerPlugins && { status: (refresh?: boolean) => window.managerPlugins.status(managerId, refresh), mutate: (action: PluginAction, version?: string, manager?: PackageManager) => window.managerPlugins.mutate(managerId, action, version, manager), onOperation: (callback: (operation: PluginOperation) => void) => window.managerPlugins.onOperation(managerId, callback) } : opencode ? window.opencodePlugin : pi ? window.piPlugin : window.plugins
  const name = managerInfo?.name || (opencode ? 'OpenCode' : pi ? 'Pi' : '9router')
  const packageName = managerId || (opencode ? 'opencode-ai' : pi ? '@earendil-works/pi-coding-agent' : '9router')
  const [plugin, setPlugin] = useState<PluginMetadata<PluginId>>()
  function update(value: PluginMetadata<PluginId>) { setPlugin(ownsOperation.current ? value : { ...value, operationError: undefined }); if (value.id === '9router') onStatus?.(value as RouterPlugin) }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<PluginAction | null>(null)
  const [selectedManager, setSelectedManager] = useState<PackageManager | ''>('')
  const [progress, setOperation] = useState<PluginOperation>({ status: 'idle', output: '' })
  const operation = progress
  const ownsOperation = useRef(false)
  const [copyMessage, setCopyMessage] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)
  const followOutput = useRef(true)
  const revealOutput = useRef(false)
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
    if (logsOpen && followOutput.current && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [operation.output, logsOpen])
  function revealInstallationOutput() {
    if (!revealOutput.current) return
    revealOutput.current = false
    requestAnimationFrame(() => outputRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }))
  }
  async function copyLog() {
    try {
      if (window.appClipboard) await window.appClipboard.writeText(operation.output)
      else await navigator.clipboard.writeText(operation.output)
      setCopyMessage('Copied')
    } catch {
      setLogsOpen(true)
      setCopyMessage('Could not copy automatically. The log is selected; press Ctrl+C (Cmd+C on Mac).')
      requestAnimationFrame(() => {
        const log = outputRef.current
        if (!log) return
        log.focus()
        const range = document.createRange(); range.selectNodeContents(log)
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
      })
    }
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
    revealOutput.current = true
    setLogsOpen(true)
    setAction(null); setBusy(true); setError(''); setCopyMessage('')
    followOutput.current = true
    setOperation({ status: 'running', output: '[Shumora] Starting operation…\n' })
    try { update(await api.mutate(requested, plugin?.latestVersion, plugin?.installed ? plugin.packageManager : selectedManager || plugin?.availableManagers?.[0])) } catch (e) {
      setError('Plugin operation failed. See Installation Output below for details.')
      setOperation(previous => ({ status: 'failed', output: `${previous.output}\n${String(e)}\n`.slice(-100_000) }))
    } finally { setBusy(false) }
  }
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <PluginDetailHeader name={name} onBack={onBack} busy={running} onRefresh={() => void refresh()} />
    <div className="router-details">
      {managerInfo ? <div className="plugin-detail-media"><img src={managerInfo.thumbnail} alt={`${name} thumbnail`} /></div> : opencode || pi ? <div className="plugin-detail-media"><img src={opencode ? opencodeThumbnail : piThumbnail} alt={`${name} thumbnail`} /></div> : <div className="plugin-detail-media"><img src={thumbnail} alt={t("Official 9router dashboard screenshot")} /></div>}
      <h2>{name}</h2><p>{plugin?.description || managerInfo?.description || (opencode ? t("An open source AI coding agent for the terminal.") : pi ? t("An extensible terminal coding agent used by Shumora workspaces.") : t("A self-hosted AI gateway connecting coding tools to multiple model providers."))}</p>
      <p className="plugin-attribution package-sources"><a href={managerInfo?.repository || (opencode ? "https://github.com/anomalyco/opencode" : pi ? "https://github.com/earendil-works/pi" : "https://github.com/decolua/9router")} target="_blank" rel="noopener noreferrer">{t("Repository")}</a><a href={`https://www.npmjs.com/package/${packageName}`} target="_blank" rel="noopener noreferrer">{t("npm")}</a><span>{t("MIT ·")} {opencode ? t("OpenCode contributors") : pi ? t("Pi contributors") : t("decolua and contributors")}</span></p>
      {!plugin && !error ? <DataSkeleton label={t("Loading plugin details")} shape="details" rows={3} /> : <dl className="settings-details"><div><dt>{t("Installation")}</dt><dd>{!plugin ? t("Checking…") : plugin.error?.startsWith('Cannot verify local') ? t("Unverified") : plugin.installed ? t("Installed") : t("Not installed")}</dd></div><div><dt>{t("Installed version")}</dt><dd>{plugin?.installedVersion || '—'}</dd></div><div><dt>{t("Latest npm version")}</dt><dd>{plugin?.latestVersion || t("Unavailable")}</dd></div>{plugin?.executable && <div><dt>{t("Executable")}</dt><dd>{plugin.executable}</dd></div>}</dl>}
      {(error || plugin?.error || plugin?.operationError) && <p className="plugin-error" role="alert">{t(pluginFailureMessage(plugin?.operationError || error || plugin?.error || ''))}</p>}
      {plugin?.installed ? <p>{t('Package manager')}: {plugin.packageManager || t('External installation')}</p> : plugin && <label className="settings-language">{t('Package manager')}<select aria-label={t('Package manager')} disabled={running} value={selectedManager || plugin.availableManagers?.[0] || ''} onChange={event => setSelectedManager(event.target.value as PackageManager)}>{!(plugin.availableManagers?.length) && <option value="">{t('No supported package manager found')}</option>}{(plugin.availableManagers || []).map(manager => <option key={manager} value={manager}>{manager}</option>)}</select></label>}
      <p className="settings-note">{t('npm, pnpm, Bun and Yarn Classic global installations are supported. Updates and removal use the verified installation owner. Lifecycle scripts are disabled. No elevation is used.')}{pi && <> {t('Stop all Workspace sessions before changing Pi.')}</>}</p>
      {plugin?.installed && plugin.managed === false && <p role="status">{t(plugin.installationKind === 'pi-windows-installer' ? 'Pi was installed by the Windows installer, not a global package manager. Use the original installer to update or uninstall Pi. Do not delete your .pi folder; it contains your agent data.' : 'Installation ownership could not be verified. Manage this installation manually.')}</p>}
      {opencode && plugin?.managed === false && <div className="release-notes"><h3>{t('Manual commands')}</h3><p>Use the installer or package manager that originally installed OpenCode.</p><pre><code>opencode upgrade</code></pre></div>}
      {plugin?.operationError && <div className="release-notes"><h3>{t("Manual commands")}</h3><p>{t('Check the executable path and use the package manager that installed it. Shumora does not request elevation.')}</p></div>}
      <h3>{t("Changelog")}{plugin?.latestVersion ? ` · ${plugin.latestVersion}` : ''}</h3>
      <div className="release-notes">{!plugin && !error ? <DataSkeleton label={t("Loading changelog")} rows={5} /> : <Markdown skipHtml components={{ a: ({ children, href }) => <span>{children}{href ? ` (${href})` : ''}</span>, img: ({ alt }) => <span>{alt}</span> }}>{plugin?.changelog || t("Refresh to load release notes from the official repository.")}</Markdown>}</div>
      <section className="plugin-output" aria-label={t("Installation output")}>
        <div className="plugin-output-header"><strong>{t("Installation Output")}</strong><span className={`plugin-output-status ${operation.status}`} role="status">{{ idle: t("Ready"), running: t("Running"), success: t("Success"), failed: t("Failed") }[operation.status]}</span><Button size="xs" variant="ghost" disabled={!operation.output} onClick={() => void copyLog()}>{t(copyMessage === 'Copied' ? 'Copied' : 'Copy log')}</Button><Button size="xs" variant="ghost" aria-expanded={logsOpen} onClick={() => setLogsOpen(value => !value)}>{logsOpen ? t("Hide output") : t("Show output")}</Button></div>
        {copyMessage && <p className="plugin-copy-status" role="status">{t(copyMessage)}</p>}
        <div className="plugin-output-body" hidden={!logsOpen}>
          <pre ref={outputRef} className="plugin-output-log" role="log" aria-label={t("Package manager operation output")} aria-live="off" tabIndex={0} onScroll={event => { const el = event.currentTarget; followOutput.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24 }}>{operation.output || t("Installation, update and uninstall output will appear here. This panel is read-only.")}</pre>
        </div>
      </section>
    </div>
    <footer className="plugin-detail-footer" aria-label={t("Plugin actions")}>
      <span className="plugin-action-status" role="status">{running ? t("Checking or applying plugin changes…") : plugin?.installed ? t("Installed · {version}", { version: plugin.installedVersion || t("Unknown version") }) : plugin ? t("Not installed") : t("Loading plugin…")}</span>
      <div className="plugin-footer-buttons">
        {managerInfo && plugin?.managed === false && <Button asChild className="library-primary-action" colorPalette="brand"><a href={managerInfo.docs} target="_blank" rel="noopener noreferrer">{name} docs</a></Button>}
        {opencode && plugin?.managed === false && <Button asChild className="library-primary-action" colorPalette="brand"><a href="https://opencode.ai/docs/" target="_blank" rel="noopener noreferrer">OpenCode docs</a></Button>}
        {plugin && !plugin.installed && <Button className="library-primary-action" colorPalette="brand" disabled={running || !plugin.latestVersion || !!plugin.error || plugin.availableManagers?.length === 0} onClick={() => setAction('install')}>{t("Install")}</Button>}
        {plugin?.installed && plugin.managed !== false && <><Button variant="outline" colorPalette="red" disabled={running} onClick={() => setAction('uninstall')}>{t("Uninstall")}</Button><Button className="library-primary-action" colorPalette="brand" disabled={running || !plugin.latestVersion || plugin.installedVersion === plugin.latestVersion || !!plugin.error} onClick={() => setAction('update')}>{t("Update")}</Button></>}
      </div>
    </footer>
    <Dialog.Root onExitComplete={revealInstallationOutput} open={action !== null} role="alertdialog" placement="center" size="md" closeOnInteractOutside={false} onOpenChange={({ open }) => { if (!open && !busy) setAction(null) }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="library-dialog">
        <Dialog.Header><Dialog.Title>{action === 'uninstall' ? t('Uninstall {name}?', { name }) : t(action === 'update' ? 'Update {name} {version}?' : 'Install {name} {version}?', { name, version: plugin?.latestVersion || '' })}</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>{t('This changes the global installation managed by {manager}.', { manager: plugin?.packageManager || selectedManager || plugin?.availableManagers?.[0] || 'npm' })} {action === 'uninstall' ? t('Other tools using {name} may be affected. Running services are not stopped automatically.', { name }) : t("The exact displayed npm version will be installed. Package lifecycle scripts are disabled; optional setup may need to be completed manually.")} {t("Root-owned installations may require you to run the command yourself.")}</Dialog.Description></Dialog.Body>
        <Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>{t("Cancel")}</Button><Button className={action === 'uninstall' ? "library-danger-action" : "library-primary-action"} colorPalette={action === 'uninstall' ? "red" : "brand"} loading={busy} disabled={busy} onClick={() => void apply()}>{t("Confirm")} {t(action === 'uninstall' ? 'uninstall' : action === 'update' ? 'update' : 'install')}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </main>
}
