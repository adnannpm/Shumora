import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { PackagePage, PiPackage, PackageInstallation, PackageAction } from '../../shared/packages'
import type { PluginOperation } from '../../shared/plugins'
import { DataSkeleton } from './DataSkeleton'
export function Packages({ initialPackage, onBack, banner }: { initialPackage?: string; onBack?: () => void; banner?: ReactNode } = {}) {
  const [data, setData] = useState<PackagePage>()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState('downloads')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<PiPackage>()
  const [confirm, setConfirm] = useState<PackageAction | null>(null)
  const [installation, setInstallation] = useState<PackageInstallation>()
  const [checking, setChecking] = useState(false)
  async function checkStatus(name: string) {
    setChecking(true); setInstallation(undefined)
    try { const value = await window.packages.status(name); setInstallation(value); setData(previous => previous ? { ...previous, items: previous.items.map(item => item.name === name ? { ...item, installation: value } : item) } : previous) }
    catch { setError('Cannot verify the personal Pi package installation. Check Pi settings and try again.') }
    finally { setChecking(false) }
  }
  useEffect(() => { if (selected) void checkStatus(selected.name) }, [selected?.name])
  const ownsOperation = useRef(false)
  const generation = useRef(0)
  function resetOutput() { ownsOperation.current = false; generation.current++; setOperation({ status: 'idle', output: '' }); setError(''); setConfirm(null); setNotice('') }
  const [operation, setOperation] = useState<PluginOperation>({ status: 'idle', output: '' })
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!initialPackage) return
    let alive = true
    setError('')
    void window.packages.detail(initialPackage).then(item => { if (alive) { resetOutput(); setSelected(item) } }).catch(() => { if (alive) setError('Cannot load package update details. Try again.') })
    return () => { alive = false }
  }, [initialPackage])
  useEffect(() => {
    let alive = true; setBusy(true); setError('')
    void window.packages?.catalog({ page, search: query, type, sort }).then(value => { if (alive) setData(value) }).catch(() => { if (alive) setError('Cannot load the Pi package gallery. Check your connection and try Refresh.') }).finally(() => { if (alive) setBusy(false) })
    if (!window.packages) { setError('Restart Shumora to load the package bridge.'); setBusy(false) }
    return () => { alive = false }
  }, [page, query, type, sort, refresh])
  useEffect(() => {
    let alive = true
    const off = window.packages?.onOperation(value => { if (alive && ownsOperation.current) setOperation(value) })
    return () => { alive = false; off?.() }
  }, [])
  async function copy() {
    try { await navigator.clipboard.writeText(`pi install npm:${selected!.name}@${selected!.version}`); setNotice('Install command copied') } catch { setNotice('Could not copy command') }
  }
  async function install() {
    if (!selected || !confirm || operation.status === 'running') return
    const action = confirm
    const current = generation.current
    ownsOperation.current = true
    setConfirm(null); setError(''); setOperation({ status: 'running', output: 'Starting Pi package installation…\n' })
    try { const result = await window.packages.mutate(action, selected.name, action === 'uninstall' ? undefined : selected.version); if (generation.current === current) setOperation(result) }
    catch { if (generation.current !== current) return; setOperation(previous => ({ ...previous, status: 'failed' })); setError('Package operation failed. Check the output below. Stop running Workspace sessions before changing packages.') }
    finally { if (generation.current === current) await checkStatus(selected.name) }
  }
  if (selected) return <section className="package-details"><Button variant="ghost" onClick={() => { resetOutput(); setSelected(undefined); onBack?.() }}>Back to packages</Button><h2>{selected.name}</h2><p>{selected.description}</p><p>{selected.author} · {selected.version || 'Version unavailable'} · {selected.types.join(', ') || 'package'}</p><p>Source: pi.dev/packages/{selected.name}</p><div className="router-control-actions">{checking ? <DataSkeleton label="Checking package installation" shape="button" /> : installation && <>{!installation.configured ? <Button variant="outline" disabled={!selected.version || operation.status === 'running'} onClick={() => setConfirm('install')}>Install globally</Button> : <><Button variant="outline" disabled={!selected.version || operation.status === 'running' || installation.installedVersion === selected.version} onClick={() => setConfirm('update')}>{installation.installed ? 'Update' : 'Repair installation'}</Button><Button variant="outline" disabled={operation.status === 'running'} onClick={() => setConfirm('uninstall')}>Uninstall</Button></>}</>}<Button variant="outline" disabled={checking || operation.status === 'running'} onClick={() => void checkStatus(selected.name)}>Refresh installation</Button><Button variant="outline" disabled={!selected.version} onClick={() => void copy()}>Copy install command</Button></div>{installation && <p role="status">{installation.installed ? `Installed · ${installation.installedVersion}` : installation.configured ? 'Configured but installation missing' : 'Not installed'} · Personal Pi scope</p>}<p className="settings-note">Global Pi scope: this adds the package to your personal Pi configuration, not the system npm global installation. Restart your Pi sessions to load it. Packages are third-party code; a gallery listing is not a security endorsement.</p>{notice && <p role="status">{notice}</p>}{error && <p className="plugin-error" role="alert">{error}</p>}<section className="plugin-output"><div className="plugin-output-header"><strong>Package Installation Output</strong><span role="status">{operation.status}</span></div><pre className="plugin-output-log" role="log" tabIndex={0}>{operation.output || 'No package operation yet.'}</pre></section><Dialog.Root open={confirm !== null} role="alertdialog" placement="center" onOpenChange={({ open }) => { if (!open) setConfirm(null) }}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>{confirm === 'uninstall' ? 'Uninstall' : confirm === 'update' ? 'Update' : 'Install'} {selected.name}?</Dialog.Title></Dialog.Header><Dialog.Body>{confirm === 'uninstall' ? 'This removes the package from your personal Pi configuration and managed installation.' : `This installs version ${selected.version} globally for your Pi sessions.`} Third-party extensions can execute code and access files with your user permissions. Review and trust the package before continuing. Stop running Workspace sessions first.</Dialog.Body><Dialog.Footer><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="outline" onClick={() => void install()}>Confirm {confirm}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root></section>
  return <section className="package-catalog">{banner}<div className="router-catalog-heading"><div><h2>Pi Packages</h2><p>Extensions, skills, themes and prompts from pi.dev/packages.</p></div><Button variant="outline" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Refresh</Button></div><form className="router-control-actions" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search) }}><input aria-label="Search packages" placeholder="Search Pi packages…" value={search} onChange={e => setSearch(e.target.value)} /><Button type="submit" variant="outline">Search</Button><select aria-label="Package type" value={type} onChange={e => { setType(e.target.value); setPage(1) }}><option value="">All types</option>{['extension', 'skill', 'theme', 'prompt'].map(value => <option key={value}>{value}</option>)}</select><select aria-label="Sort packages" value={sort} onChange={e => { setSort(e.target.value); setPage(1) }}><option value="downloads">Popular</option><option value="recent">Recently updated</option><option value="name">Name</option></select></form>{error && <p className="plugin-error" role="alert">{error}</p>}{busy ? <DataSkeleton label="Loading packages" shape="providers" /> : <><div className="router-catalog-grid">{data?.items.map(item => <button key={item.name} className="package-catalog-card" aria-label={`View ${item.name}`} onClick={() => { resetOutput(); setSelected(item) }}><strong>{item.name}</strong><p>{item.description}</p><small>{item.author} · {item.downloads.toLocaleString()} downloads/month</small><span>{item.types.join(' · ') || 'package'} · {item.version}</span><small>{!item.installation ? 'Installation unverified' : item.installation.installed ? `Installed · ${item.installation.installedVersion}${item.installation.installedVersion !== item.version ? ' · Different catalog version available' : ''}` : item.installation.configured ? 'Configured · Repair needed' : 'Not installed'}</small></button>)}</div>{!error && !data?.items.length && <p>No matching packages.</p>}<nav className="router-control-actions" aria-label="Package pages"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {data?.pages || page}</span><Button variant="outline" disabled={!data || page >= data.pages} onClick={() => setPage(value => value + 1)}>Next</Button></nav></>}</section>
}
