import { useEffect, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import Markdown from 'react-markdown'
import type { PluginAction, RouterPlugin } from '../../shared/plugins'
import thumbnail from './assets/9router-thumbnail.png'
export function RouterCard({ onOpen }: { onOpen: () => void }) {
  const [plugin, setPlugin] = useState<RouterPlugin>()
  useEffect(() => { void window.plugins?.status().then(setPlugin).catch(() => {}) }, [])
  return <button className="plugin-card" onClick={onOpen} aria-label="Open 9router plugin">
    <img src={thumbnail} alt="9router dashboard preview" />
    <span className="plugin-card-content"><strong>9router</strong><span>A self-hosted AI gateway for coding tools, with provider routing, automatic fallback, and quota tracking.</span><small>{plugin ? plugin.error ? 'Installation status unavailable' : plugin.installed ? `Installed · ${plugin.installedVersion}` : 'Not installed' : 'Checking installation…'}</small></span>
  </button>
}
export function RouterDetails({ onBack, onStatus }: { onBack?: () => void; onStatus?: (plugin: RouterPlugin) => void }) {
  const [plugin, setPlugin] = useState<RouterPlugin>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<PluginAction | null>(null)
  async function refresh() {
    setBusy(true); setError('')
    try { if (!window.plugins) throw new Error('Restart Shumora to load the plugin bridge.'); const value = await window.plugins.status(true); setPlugin(value); onStatus?.(value) } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function apply() {
    if (!action || busy) return
    setBusy(true); setError('')
    try { const value = await window.plugins.mutate(action, plugin?.latestVersion); setPlugin(value); onStatus?.(value); setAction(null) } catch (e) { setError(String(e)); setAction(null) } finally { setBusy(false) }
  }
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar router-toolbar">
      <div className="router-heading">{onBack && <Button size="sm" variant="ghost" aria-label="Back to plugins" title="Back to plugins" onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg></Button>}<h1>9router plugin</h1></div>
      <Button size="sm" variant="ghost" aria-label="Refresh status" title="Refresh status" disabled={busy} onClick={() => void refresh()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17" /></svg></Button>
    </header>
    <div className="router-details">
      <div className="plugin-detail-media"><img src={thumbnail} alt="Official 9router dashboard screenshot" /></div>
      <h2>9router</h2><p>{plugin?.description || 'A self-hosted AI gateway connecting coding tools to multiple model providers.'}</p>
      <p className="plugin-attribution">Source: github.com/decolua/9router · MIT · decolua and contributors</p>
      <dl className="settings-details"><div><dt>Installation</dt><dd>{!plugin ? 'Checking…' : plugin.error?.startsWith('Cannot verify local') ? 'Unverified' : plugin.installed ? 'Installed' : 'Not installed'}</dd></div><div><dt>Installed version</dt><dd>{plugin?.installedVersion || '—'}</dd></div><div><dt>Latest npm version</dt><dd>{plugin?.latestVersion || 'Unavailable'}</dd></div>{plugin?.executable && <div><dt>Executable</dt><dd>{plugin.executable}</dd></div>}</dl>
      {(error || plugin?.error || plugin?.operationError) && <p className="plugin-error" role="alert">{error || plugin?.operationError || plugin?.error}</p>}
      <p className="settings-note">Only the npm installation visible on PATH is managed. Installed does not mean running. Docker/source installations and starting the 9router service are not managed here. No sudo or privilege elevation is used.</p>
      {plugin?.operationError && <div className="release-notes"><h3>Manual commands</h3><p>Run these yourself in a terminal with the appropriate permissions. Shumora does not request elevation.</p><pre><code>{`npm install -g 9router@${plugin.latestVersion || '<version>'}\n# To remove instead:\nnpm uninstall -g 9router`}</code></pre></div>}
      <h3>Changelog{plugin?.latestVersion ? ` · ${plugin.latestVersion}` : ''}</h3>
      <div className="release-notes"><Markdown skipHtml components={{ a: ({ children, href }) => <span>{children}{href ? ` (${href})` : ''}</span>, img: ({ alt }) => <span>{alt}</span> }}>{plugin?.changelog || 'Refresh to load release notes from the official repository.'}</Markdown></div>
    </div>
    <footer className="plugin-detail-footer" aria-label="Plugin actions">
      <span className="plugin-action-status" role="status">{busy ? 'Checking or applying plugin changes…' : plugin?.installed ? `Installed · ${plugin.installedVersion || 'Unknown version'}` : plugin ? 'Not installed' : 'Loading plugin…'}</span>
      <div className="plugin-footer-buttons">
        {plugin && !plugin.installed && <Button colorPalette="brand" disabled={busy || !plugin.latestVersion || !!plugin.error} onClick={() => setAction('install')}>Install</Button>}
        {plugin?.installed && <><Button variant="outline" colorPalette="red" disabled={busy} onClick={() => setAction('uninstall')}>Uninstall</Button><Button colorPalette="brand" disabled={busy || !plugin.latestVersion || plugin.installedVersion === plugin.latestVersion || !!plugin.error} onClick={() => setAction('update')}>Update</Button></>}
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
