import { useLanguage } from './Language'
import { useEffect, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { LibraryUpdate, LibraryUpdates as UpdateResult } from '../../shared/packages'
import { DataSkeleton } from './DataSkeleton'
export function LibraryUpdates({ onView, scope }: { onView: (item: LibraryUpdate) => void; scope?: 'package' | 'plugin' }) {
  const { t, language } = useLanguage()
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
  // The count shown here is always the number of available updates, never the
  // number of installed or checked packages, to avoid a confusing "0 packages".
  const packageUpdates = result?.items.filter(i => i.kind === 'package').length || 0
  const pluginUpdates = result?.items.filter(i => i.kind === 'plugin').length || 0
  const plural = (count: number, noun: string) => language === 'id' ? t(noun === 'plugin update' ? '{count} plugin updates' : '{count} package updates', { count }) : `${count} ${noun}${count === 1 ? '' : 's'}`
  const subtitle = scope
    ? plural(result?.items.length || 0, scope === 'plugin' ? 'plugin update' : 'package update')
    : `${plural(packageUpdates, 'package update')} · ${plural(pluginUpdates, 'plugin update')}`
  return <section className="library-updates" aria-label={t("Library updates")}>
    <div className="library-updates-summary">{busy ? <DataSkeleton label={t("Checking Library updates")} rows={2} /> : <div><strong>{result?.items.length ? language === 'id' ? t('{count} updates available', { count: result.items.length }) : `${result.items.length} update${result.items.length === 1 ? '' : 's'} available` : result?.errors.length ? t("Update check incomplete") : t(scope === 'plugin' ? 'All checked plugins are up to date' : scope === 'package' ? 'All checked packages are up to date' : 'All checked packages and plugins are up to date')}</strong><p>{subtitle}{result?.errors.length ? language === 'id' ? t(' · {count} checks failed', { count: result.errors.length }) : ` · ${result.errors.length} check${result.errors.length === 1 ? '' : 's'} failed` : ''}</p></div>}</div>
    <div className="router-control-actions"><Button variant="outline" disabled={busy || !result} onClick={() => setOpen(true)}>{t("Update details")}</Button><Button variant="ghost" disabled={busy} onClick={() => void check()}>{t("Check updates")}</Button></div>
    <Dialog.Root open={open} placement="center" size="lg" onOpenChange={({ open }) => setOpen(open)}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="library-dialog"><Dialog.Header><Dialog.Title>{t("Library updates")}</Dialog.Title></Dialog.Header><Dialog.Body>
      {(['package', 'plugin'] as const).filter(kind => !scope || kind === scope).map(kind => <section key={kind}><h3>{kind === 'package' ? t("Packages") : t("Plugins")}</h3>{result?.items.filter(i => i.kind === kind).map(item => <div className="library-update-row" key={`${kind}-${item.id}`}><div><strong>{item.name}</strong><p>{item.installedVersion} → {item.latestVersion}</p></div><Button variant="outline" aria-label={t("View update for {name}", { name: item.name })} onClick={() => { setOpen(false); onView(item) }}>{t("View")}</Button></div>)}</section>)}
      {result?.errors.map(error => <p className="plugin-error" key={error}>{t(error)}</p>)}
    </Dialog.Body><Dialog.Footer><Button variant="outline" onClick={() => setOpen(false)}>{t("Close")}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </section>
}
