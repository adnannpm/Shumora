import { useLanguage } from './Language'
import { useEffect, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { LibraryUpdate, LibraryUpdates as UpdateResult } from '../../shared/packages'
export function LibraryUpdates({ onView, scope }: { onView: (item: LibraryUpdate) => void; scope?: 'package' | 'plugin' }) {
  const { t } = useLanguage()
  const [result, setResult] = useState<UpdateResult>()
  const [busy, setBusy] = useState(true)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  async function check(manual = false) {
    setBusy(true)
    setNotice('')
    try {
      if (!window.packages) throw new Error()
      const next = await window.packages.updates(scope)
      setResult(next)
      if (manual) setNotice(next.errors.length ? 'Update check incomplete' : next.items.length ? '' : 'All checked packages and plugins are up to date')
    }
    catch {
      setResult({ items: [], errors: ['Could not check Library updates. Try again.'] })
      if (manual) setNotice('Update check incomplete')
    }
    finally { setBusy(false) }
  }
  useEffect(() => { void check() }, [])
  const count = result?.items.length || 0
  return <section className="library-updates" aria-label={t("Library updates")}>
    {count > 0 || !!result?.errors.length ? <Button size="xs" variant="outline" className="library-update-badge" title={t(scope === 'package' ? 'Package updates' : scope === 'plugin' ? 'Plugin updates' : 'Updates across packages and plugins')} onClick={() => setOpen(true)}>{count > 0 ? t('Updates · {count}', { count }) : t('Update check incomplete')}</Button> : null}
    <Button size="xs" variant="ghost" className="library-update-check" disabled={busy} aria-busy={busy} title={busy ? t('Checking Library updates') : t('Check updates')} onClick={() => void check(true)}>{t("Check updates")}{busy && <span className="library-check-indicator" aria-hidden="true">…</span>}</Button>
    <span role="status" className="library-update-status">{notice && t(notice)}</span>
    <Dialog.Root open={open} placement="center" size="lg" onOpenChange={({ open }) => setOpen(open)}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="library-dialog"><Dialog.Header><Dialog.Title>{t("Library updates")}</Dialog.Title></Dialog.Header><Dialog.Body>
      {!count && !result?.errors.length && <p>{t('All checked packages and plugins are up to date')}</p>}
      {(['package', 'plugin'] as const).filter(kind => (!scope || kind === scope) && result?.items.some(item => item.kind === kind)).map(kind => <section className="library-update-group" key={kind}><h3>{kind === 'package' ? t("Packages") : t("Plugins")} · {result?.items.filter(item => item.kind === kind).length}</h3>{result?.items.filter(i => i.kind === kind).map(item => <div className="library-update-row" key={`${kind}-${item.id}`}><div><strong>{item.name}</strong><p>{item.installedVersion} → {item.latestVersion}</p></div><Button variant="outline" aria-label={t("View update for {name}", { name: item.name })} onClick={() => { setOpen(false); onView(item) }}>{t("View")}</Button></div>)}</section>)}
      {result?.errors.map(error => <p className="plugin-error" key={error}>{t(error)}</p>)}
    </Dialog.Body><Dialog.Footer><Button variant="outline" onClick={() => setOpen(false)}>{t("Close")}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </section>
}
