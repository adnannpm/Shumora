import { useEffect, useState } from 'react'
import { Button, Tabs } from '@chakra-ui/react'
import { RouterProviders, RouterModels } from './RouterCatalog'
import { RouterAuth } from './RouterAuth'
import { DataSkeleton } from './DataSkeleton'
import type { RouterPlugin, RouterState, RouterControl, RouterKey } from '../../shared/plugins'

export function RouterDashboard() {
  const [tab, setTab] = useState('overview')
  const [authRevision, setAuthRevision] = useState(0)
  const [plugin, setPlugin] = useState<RouterPlugin>()
  const [error, setError] = useState('')
  const [service, setService] = useState<RouterState>({ online: false, managed: false, busy: false, logs: '' })
  const [busy, setBusy] = useState(false)
  const [keys, setKeys] = useState<RouterKey[]>([])
  const [keyError, setKeyError] = useState('')
  const [keyBusy, setKeyBusy] = useState(false)
  const [name, setName] = useState('')
  const [revealed, setRevealed] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  async function loadKeys() {
    setKeyBusy(true); setKeyError('')
    try { setKeys(await window.plugins.routerKeys()) } catch { setKeyError('Cannot load API keys. Check the connection and sign in to 9router using the button in the header.'); setKeys([]) }
    finally { setKeyBusy(false) }
  }
  async function createKey() {
    if (!name.trim() || keyBusy) return
    setKeyBusy(true); setKeyError('')
    try { const key = await window.plugins.routerCreateKey(name); setKeys(previous => [...previous, key]); setName('') }
    catch { setKeyError('Could not create API key. Check the connection and dashboard authentication.') }
    finally { setKeyBusy(false) }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('Copied to clipboard') } catch { setNotice('Could not copy to clipboard') }
  }
  async function control(action: RouterControl) {
    setBusy(true); setError('')
    try { const value = await window.plugins.routerControl(action); setService(value); setOnline(value.online) }
    catch { setError('Service operation failed. See the Logs tab for details.') }
    finally { setBusy(false) }
  }
  const [online, setOnline] = useState<boolean | null>(null)
  const serviceLabel = online === null ? 'Checking…' : online ? 'Online' : 'Offline'
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function probe() {
      let result = false
      try {
        if (window.plugins.routerState) {
          const value = await window.plugins.routerState()
          if (active) setService(value)
          result = value.online
        } else result = await window.plugins.health()
      } catch { /* Missing bridge or unreachable service. */ }
      if (!active) return
      setOnline(result)
      timer = setTimeout(() => void probe(), 5000)
    }
    void probe()
    return () => { active = false; clearTimeout(timer) }
  }, [])
  useEffect(() => {
    if (online) void loadKeys()
    else { setKeys([]); setRevealed([]) }
  }, [online, authRevision])
  useEffect(() => {
    let active = true
    async function check() {
      try {
        if (!window.plugins) throw new Error('Restart Shumora to load the plugin bridge.')
        const value = await window.plugins.status()
        if (active) { setPlugin(value); setError(value.error || '') }
      } catch (e) { if (active) setError(String(e)) }
    }
    void check()
    return () => { active = false }
  }, [])
  return <main className="library-page router-dashboard flex min-w-0 flex-1 flex-col">
    <header className="toolbar router-toolbar"><h1>9router</h1><div className="router-header-actions"><RouterAuth onChange={() => { setKeys([]); setRevealed([]); setAuthRevision(value => value + 1) }} /><span className="router-service-status" role="status" aria-label={`9router ${online === null ? 'checking' : online ? 'online' : 'offline'}`} title="Local health check · 127.0.0.1:20128"><span aria-hidden="true" className={`router-service-dot ${online === null ? 'checking' : online ? 'online' : 'offline'}`} />{serviceLabel}</span></div></header>
    <Tabs.Root value={tab} onValueChange={({ value }) => setTab(value)} variant="line" fitted lazyMount unmountOnExit colorPalette="brand" className="library-tabs">
      <Tabs.List aria-label="9router sections" className="library-tablist">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="providers">Providers</Tabs.Trigger>
        <Tabs.Trigger value="models">Models</Tabs.Trigger>
        <Tabs.Trigger value="logs">Logs</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Content value="overview" className="library-content">
        <h2>9router overview</h2>
        <p>Your local AI gateway, connection endpoint and API keys.</p>
        <section className="router-overview-card"><h2>Service</h2>{online === null ? <DataSkeleton label="Loading service status" shape="service" /> : <p>{service.managed ? online ? 'Running · managed by Shumora' : 'Starting or unavailable · managed by Shumora' : online ? 'External instance · manage its process outside Shumora' : 'Service is offline'} · Local port 20128</p>}
          <div className="router-control-actions"><Button variant="outline" disabled={busy || service.busy || online !== false || service.managed || !plugin?.installed} onClick={() => void control('start')}>Start</Button><Button variant="outline" disabled={busy || service.busy || !service.managed} onClick={() => void control('restart')}>Restart</Button><Button variant="outline" disabled={busy || service.busy || !service.managed} onClick={() => void control('stop')}>Stop</Button></div>
          {(busy || service.busy) && <p role="status">Applying service changes…</p>}
          {online && !service.managed && <p className="settings-note">Stop 9router from its tray or terminal first, then press Start here to enable Shumora's Stop and Restart controls.</p>}
          <p className="settings-note">Stop and Restart affect active requests. Only Shumora-started processes are controlled, and they stop when Shumora quits.</p>
        </section>
        <section className="router-overview-card"><h2>API Endpoint</h2><div className="router-endpoint"><code>http://127.0.0.1:20128/v1</code><Button size="sm" variant="outline" onClick={() => void copy('http://127.0.0.1:20128/v1')}>Copy endpoint</Button></div><p>OpenAI-compatible base URL for your coding tools.</p></section>
        <section className="router-overview-card"><h2>API Keys</h2><p>Keys are managed by 9router, not stored in the Shumora database.</p>
          {keyError && <p className="plugin-error" role="alert">{keyError}</p>}
          {(online === null || keyBusy) && !keys.length && <DataSkeleton label="Loading API keys" shape="keys" />}
          {online === false && <p>Start or connect to 9router to load API keys.</p>}
          {online && !keyBusy && !keys.length && !keyError && <p>No API keys yet.</p>}
          {keys.map(key => <div className="router-key-row" key={key.id}><strong>{key.name}</strong><code>{revealed.includes(key.id) ? key.key : '••••••••••••••••'}</code><Button size="sm" variant="ghost" aria-label={`${revealed.includes(key.id) ? 'Hide' : 'Show'} ${key.name} key`} onClick={() => setRevealed(previous => previous.includes(key.id) ? previous.filter(id => id !== key.id) : [...previous, key.id])}>{revealed.includes(key.id) ? 'Hide' : 'Show'}</Button><Button size="sm" variant="ghost" aria-label={`Copy ${key.name} key`} onClick={() => void copy(key.key)}>Copy</Button></div>)}
          <form className="router-control-actions" onSubmit={event => { event.preventDefault(); void createKey() }}><input aria-label="API key name" placeholder="Key name, e.g. Coding tools" value={name} maxLength={100} disabled={!online || keyBusy} onChange={event => setName(event.target.value)} /><Button type="submit" variant="outline" disabled={!online || keyBusy || !name.trim()}>Create API Key</Button><Button variant="ghost" disabled={!online || keyBusy} onClick={() => void loadKeys()}>Refresh keys</Button></form>
        </section>
        {notice && <p role="status">{notice}</p>}
        {error && <p className="plugin-error" role="alert">{error}</p>}


      </Tabs.Content>
      <Tabs.Content value="providers" className="library-content"><RouterProviders key={authRevision} /></Tabs.Content>
      <Tabs.Content value="models" className="library-content"><RouterModels key={authRevision} /></Tabs.Content>
      <Tabs.Content value="logs" className="library-content router-logs-panel"><h2>Service logs</h2><p>Output from Shumora-managed processes. External service logs are unavailable here.</p>{online === null ? <DataSkeleton label="Loading service logs" shape="logs" rows={10} /> : <pre className="plugin-output-log" role="log" tabIndex={0}>{service.logs || 'No service output yet.'}</pre>}</Tabs.Content>
    </Tabs.Root>
  </main>
}
