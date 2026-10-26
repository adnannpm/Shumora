import { useEffect, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { LibraryUpdate, LibraryUpdates as UpdateResult } from '../../shared/packages'
import { DataSkeleton } from './DataSkeleton'
export function LibraryUpdates({ onView, scope }: { onView: (item: LibraryUpdate) => void; scope?: 'package' | 'plugin' }) {
  const [result, setResult] = useState<UpdateResult>()
  const [busy, setBusy] = useState(true)
  const [open, setOpen] = useState(false)
  async function check() {
    setBusy(true)
    try { if (!window.packages) throw new Error(); setResult(await window.packages.updates(scope)) }
    catch { setResult({ items: [], errors: ['Could not check Library updates. Try again.'] }) }
    finally { setBusy(false) }
  }
  useEffect(() => { void check() }, [])
  return <section className="library-updates" aria-label="Library updates">
    <div className="library-updates-summary">{busy ? <DataSkeleton label="Checking Library updates" rows={2} /> : <div><strong>{result?.items.length ? `${result.items.length} updates available` : result?.errors.length ? 'Update check incomplete' : `All checked ${scope === 'plugin' ? 'plugins' : scope === 'package' ? 'packages' : 'packages and plugins'} are up to date`}</strong><p>{scope ? `${result?.items.length || 0} ${scope === 'plugin' ? 'plugins' : 'packages'}` : `${result?.items.filter(i => i.kind === 'package').length || 0} packages · ${result?.items.filter(i => i.kind === 'plugin').length || 0} plugins`}{result?.errors.length ? ` · ${result.errors.length} checks failed` : ''}</p></div>}</div>
    <div className="router-control-actions"><Button variant="outline" disabled={busy || !result} onClick={() => setOpen(true)}>Update details</Button><Button variant="ghost" disabled={busy} onClick={() => void check()}>Check updates</Button></div>
    <Dialog.Root open={open} placement="center" size="lg" onOpenChange={({ open }) => setOpen(open)}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>Library updates</Dialog.Title></Dialog.Header><Dialog.Body>
      {(['package', 'plugin'] as const).filter(kind => !scope || kind === scope).map(kind => <section key={kind}><h3>{kind === 'package' ? 'Packages' : 'Plugins'}</h3>{result?.items.filter(i => i.kind === kind).map(item => <div className="library-update-row" key={`${kind}-${item.id}`}><div><strong>{item.name}</strong><p>{item.installedVersion} → {item.latestVersion}</p></div><Button variant="outline" aria-label={`View update for ${item.name}`} onClick={() => { setOpen(false); onView(item) }}>View</Button></div>)}</section>)}
      {result?.errors.map(error => <p className="plugin-error" key={error}>{error}</p>)}
    </Dialog.Body><Dialog.Footer><Button variant="outline" onClick={() => setOpen(false)}>Close</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </section>
}
