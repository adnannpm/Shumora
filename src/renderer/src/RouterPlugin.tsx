import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import Markdown from 'react-markdown'
import type { PluginAction, PluginOperation, RouterPlugin } from '../../shared/plugins'
import thumbnail from './assets/9router-thumbnail.png'
import { DataSkeleton } from './DataSkeleton'
export function RouterCard({ onOpen }: { onOpen: () => void }) {
  const [plugin, setPlugin] = useState<RouterPlugin>()
  const [checking, setChecking] = useState(true)
  useEffect(() => { void (async () => { try { setPlugin(await window.plugins?.status()) } catch { /* Display unavailable instead of loading forever. */ } finally { setChecking(false) } })() }, [])
  return <button className="plugin-card" onClick={onOpen} aria-label="Open 9router plugin">
    <img src={thumbnail} alt="9router dashboard preview" />
    <span className="plugin-card-content"><strong>9router</strong><span>A self-hosted AI gateway for coding tools, with provider routing, automatic fallback, and quota tracking.</span><small>{plugin ? plugin.error ? 'Installation status unavailable' : plugin.installed ? `Installed · ${plugin.installedVersion}` : 'Not installed' : checking ? <DataSkeleton label="Loading installation status" rows={1} /> : 'Installation status unavailable'}</small></span>
  </button>
}
export function RouterDetails({ onBack, onStatus }: { onBack?: () => void; onStatus?: (plugin: RouterPlugin) => void }) {
  const [plugin, setPlugin] = useState<RouterPlugin>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<PluginAction | null>(null)
  const [progress, setOperation] = useState<PluginOperation>({ status: 'idle', output: '' })
  const operation: PluginOperation = progress.status === 'idle' && plugin?.operationError
    ? { status: 'failed', output: plugin.operationError.slice(-100_000) }
    : progress
  const [copyMessage, setCopyMessage] = useState('')
  const outputRef = useRef<HTMLPreElement>(null)
  const followOutput = useRef(true)
  const running = busy || operation.status === 'running'
  useEffect(() => {
    let active = true
    let received = false
    const off = window.plugins?.onOperation?.(value => { received = true; if (active) setOperation(value) })
    void window.plugins?.operation?.().then(value => { if (active && !received) setOperation(value) }).catch(() => {})
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
    try { if (!window.plugins) throw new Error('Restart Shumora to load the plugin bridge.'); const value = await window.plugins.status(true); setPlugin(value); onStatus?.(value) } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function apply() {
    if (!action || running) return
    const requested = action
    setAction(null); setBusy(true); setError(''); setCopyMessage('')
    followOutput.current = true
    setOperation({ status: 'running', output: '[Shumora] Starting operation…\n' })
    outputRef.current?.scrollIntoView?.({ block: 'nearest' })
    try { const value = await window.plugins.mutate(requested, plugin?.latestVersion); setPlugin(value); onStatus?.(value) } catch (e) {
      setError('Plugin operation failed. See Installation Output below for details.')
      setOperation(previous => ({ status: 'failed', output: `${previous.output}\n${String(e)}\n`.slice(-100_000) }))
    } finally { setBusy(false) }
  }
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar router-toolbar">
      <div className="router-heading">{onBack && <Button size="sm" variant="ghost" aria-label="Back to plugins" title="Back to plugins" onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg></Button>}<h1>9router plugin</h1></div>
      <Button size="sm" variant="ghost" aria-label="Refresh status" title="Refresh status" disabled={running} onClick={() => void refresh()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17" /></svg></Button>
    </header>
    <div className="router-details">
      <div className="plugin-detail-media"><img src={thumbnail} alt="Official 9router dashboard screenshot" /></div>
      <h2>9router</h2><p>{plugin?.description || 'A self-hosted AI gateway connecting coding tools to multiple model providers.'}</p>
      <p className="plugin-attribution">Source: github.com/decolua/9router · MIT · decolua and contributors</p>
      {!plugin && !error ? <DataSkeleton label="Loading plugin details" shape="details" rows={3} /> : <dl className="settings-details"><div><dt>Installation</dt><dd>{!plugin ? 'Checking…' : plugin.error?.startsWith('Cannot verify local') ? 'Unverified' : plugin.installed ? 'Installed' : 'Not installed'}</dd></div><div><dt>Installed version</dt><dd>{plugin?.installedVersion || '—'}</dd></div><div><dt>Latest npm version</dt><dd>{plugin?.latestVersion || 'Unavailable'}</dd></div>{plugin?.executable && <div><dt>Executable</dt><dd>{plugin.executable}</dd></div>}</dl>}
      {(error || plugin?.error || plugin?.operationError) && <p className="plugin-error" role="alert">{error || (plugin?.operationError ? 'Plugin operation failed. See Installation Output below for details.' : plugin?.error)}</p>}
      <p className="settings-note">Only the npm installation visible on PATH is managed. Installed does not mean running. Docker/source installations and starting the 9router service are not managed here. No sudo or privilege elevation is used.</p>
      {plugin?.operationError && <div className="release-notes"><h3>Manual commands</h3><p>Run these yourself in a terminal with the appropriate permissions. Shumora does not request elevation.</p><pre><code>{`npm install -g 9router@${plugin.latestVersion || '<version>'}\n# To remove instead:\nnpm uninstall -g 9router`}</code></pre></div>}
      <h3>Changelog{plugin?.latestVersion ? ` · ${plugin.latestVersion}` : ''}</h3>
      <div className="release-notes">{!plugin && !error ? <DataSkeleton label="Loading changelog" rows={5} /> : <Markdown skipHtml components={{ a: ({ children, href }) => <span>{children}{href ? ` (${href})` : ''}</span>, img: ({ alt }) => <span>{alt}</span> }}>{plugin?.changelog || 'Refresh to load release notes from the official repository.'}</Markdown>}</div>
      <section className="plugin-output" aria-label="Installation output">
        <div className="plugin-output-header"><strong>Installation Output</strong><span className={`plugin-output-status ${operation.status}`} role="status">{{ idle: 'Ready', running: 'Running', success: 'Success', failed: 'Failed' }[operation.status]}</span><Button size="xs" variant="ghost" disabled={!operation.output} onClick={() => void copyLog()}>Copy log</Button></div>
        <pre ref={outputRef} className="plugin-output-log" role="log" aria-label="npm operation output" aria-live="off" tabIndex={0} onScroll={event => { const el = event.currentTarget; followOutput.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24 }}>{operation.output || 'Installation, update and uninstall output will appear here. This panel is read-only.'}</pre>
        {copyMessage && <p className="plugin-copy-status" role="status">{copyMessage}</p>}
      </section>
    </div>
    <footer className="plugin-detail-footer" aria-label="Plugin actions">
      <span className="plugin-action-status" role="status">{running ? 'Checking or applying plugin changes…' : plugin?.installed ? `Installed · ${plugin.installedVersion || 'Unknown version'}` : plugin ? 'Not installed' : 'Loading plugin…'}</span>
      <div className="plugin-footer-buttons">
        {plugin && !plugin.installed && <Button colorPalette="brand" disabled={running || !plugin.latestVersion || !!plugin.error} onClick={() => setAction('install')}>Install</Button>}
        {plugin?.installed && <><Button variant="outline" colorPalette="red" disabled={running} onClick={() => setAction('uninstall')}>Uninstall</Button><Button colorPalette="brand" disabled={running || !plugin.latestVersion || plugin.installedVersion === plugin.latestVersion || !!plugin.error} onClick={() => setAction('update')}>Update</Button></>}
      </div>
    </footer>
    <Dialog.Root open={action !== null} role="alertdialog" placement="center" size="md" closeOnInteractOutside={false} onOpenChange={({ open }) => { if (!open && !busy) setAction(null) }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>{action === 'uninstall' ? 'Uninstall 9router?' : `${action === 'update' ? 'Update' : 'Install'} 9router ${plugin?.latestVersion || ''}?`}</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>This changes your system npm global installation. {action === 'uninstall' ? 'Other tools using 9router may be affected. Running services are not stopped automatically.' : 'The exact displayed npm version will be installed. Package lifecycle scripts are disabled; optional setup may need to be completed manually.'} Root-owned installations may require you to run the command yourself.</Dialog.Description></Dialog.Body>
        <Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button colorPalette={action === 'uninstall' ? 'red' : 'brand'} loading={busy} disabled={busy} onClick={() => void apply()}>Confirm {action}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </main>
}
