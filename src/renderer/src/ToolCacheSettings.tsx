import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { ToolCacheReport } from '../../shared/tool-cache'
import { useLanguage } from './Language'
function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}
export function ToolCacheSettings() {
  const { t } = useLanguage()
  const [report,setReport] = useState<ToolCacheReport>()
  const [busy,setBusy] = useState(false)
  const [cleaning,setCleaning] = useState(false)
  const [error,setError] = useState('')
  const [confirm,setConfirm] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  async function load(clear = false) {
    setBusy(true); setCleaning(clear); setError('')
    try {
      if (!window.toolCache) throw new Error('unavailable')
      setReport(await (clear ? window.toolCache.clear() : window.toolCache.scan()))
    } catch { setError(clear ? 'Could not clean the cache. Stop running terminal sessions and installation operations, then try again.' : 'Could not check cache size. Restart Shumora and try again.') }
    finally { setBusy(false); setCleaning(false) }
  }
  useEffect(() => { void load() },[])
  return <>
    <h2>{t('Storage')}</h2>
    <p>{t('Clear temporary files. Your conversations and settings stay safe.')}</p>
    <section className="settings-section storage-settings" aria-busy={busy}>
      <div className="storage-overview">
        <div><div className="storage-total" aria-live="polite">{report ? size(report.totalBytes) : '—'}</div><h3>{t('Safe-to-clean cache')}</h3></div>
        <div className="storage-actions"><Button variant="outline" size="sm" loading={busy && !cleaning} disabled={busy} onClick={() => void load()}>{t('Check again')}</Button><Button variant="outline" size="sm" loading={cleaning} disabled={busy || !report?.totalBytes} onClick={() => setConfirm(true)}>{t('Clear cache')}</Button></div>
      </div>
      {!report && busy && <p role="status">{t('Checking…')}</p>}
      {report && report.totalBytes === 0 && !report.entries.some(entry => entry.failed) && <p className="storage-empty" role="status">{t('No cache needs cleaning.')}</p>}
      <dl className="storage-tool-list">{report?.entries.filter(entry => entry.supported).map(entry => <div key={entry.id}><dt>{entry.name}<small>{entry.failed ? t('Could not check all files') : `${entry.files} ${t('temporary files')}`}</small></dt><dd>{size(entry.bytes)}</dd></div>)}</dl>
      {!!report?.entries.some(entry => !entry.supported) && <details className="storage-unsupported"><summary>{t('Other tools')} <span>{report.entries.filter(entry => !entry.supported).length}</span></summary><p>{t('Safe cleanup is not available for these tools yet. Their files will not be deleted.')}</p><ul>{report.entries.filter(entry => !entry.supported).map(entry => <li key={entry.id}>{entry.name}</li>)}</ul></details>}
      <p className="storage-footnote">{t('Cache may be recreated when you use the tools again.')}</p>
      {report?.freedBytes !== undefined && <p role="status">{t('Cleaned {size} of cache.',{size:size(report.freedBytes)})}{report.entries.some(entry => entry.failed) && <> {t('Some files could not be cleaned. Try again after closing other tools.')}</>}</p>}
      {error && <p role="alert">{t(error)}</p>}
    </section>
    <Dialog.Root open={confirm} onOpenChange={({open})=>setConfirm(open)} placement="center" size="sm" initialFocusEl={()=>cancel.current}>
      <Portal><Dialog.Backdrop/><Dialog.Positioner><Dialog.Content className="library-dialog storage-dialog">
        <Dialog.Header><Dialog.Title>{t('Clear cache?')}</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>{t('This removes {size} of temporary files. Conversations, sign-ins, settings, projects and downloaded models are kept.',{size:size(report?.totalBytes || 0)})}</Dialog.Description></Dialog.Body>
        <Dialog.Footer><Button ref={cancel} variant="outline" onClick={()=>setConfirm(false)}>{t('Cancel')}</Button><Button size="sm" variant="outline" onClick={()=>{setConfirm(false);void load(true)}}>{t('Clear cache')}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
