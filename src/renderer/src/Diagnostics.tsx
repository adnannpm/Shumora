import { useRef, useState } from 'react'
import { Button } from '@chakra-ui/react'
import type { DiagnosticReport } from '../../shared/diagnostics'
import { useLanguage } from './Language'

export function Diagnostics({ embedded = false }: { embedded?: boolean }) {
  const { t } = useLanguage()
  const [report, setReport] = useState<DiagnosticReport>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const reportElement = useRef<HTMLPreElement>(null)
  const running = useRef(false)
  async function run() {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setNotice('')
    try { setReport(await window.diagnostics.run()) }
    catch { setError('Could not check Pi. Restart Shumora and try again.') }
    finally { running.current = false; setBusy(false) }
  }
  async function copy() {
    if (!report) return
    try {
      const text = JSON.stringify(report, null, 2)
      if (window.appClipboard) await window.appClipboard.writeText(text)
      else await navigator.clipboard.writeText(text)
      setNotice('Report copied. Review it before sharing with support.')
    } catch {
      setDetailsOpen(true)
      setNotice('Could not copy automatically. The report is selected; press Ctrl+C (Cmd+C on Mac).')
      requestAnimationFrame(() => {
        const element = reportElement.current
        if (!element) return
        element.focus()
        const range = document.createRange(); range.selectNodeContents(element)
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
      })
    }
  }
  const missing = report && !report.pi.executable
  const result = report?.launch.ok ? 'Pi can be started.' : missing ? 'Pi was not found.' : 'Pi was found, but could not be started.'
  const guidance = report?.launch.ok ? 'AI connections and accounts have not been checked.' : missing
    ? 'Open Library → Pi to check its installation. If you just installed Pi, restart Shumora and check again.'
    : 'Restart Shumora and check again. If it still fails, copy the report and send it to support. You do not need to delete your conversations or settings.'
  return <section className="terminal-check" aria-busy={busy}>
    {embedded ? <h3>{t('Check terminal')}</h3> : <h2>{t('Check terminal')}</h2>}
    <p>{t('Terminal not opening? Check whether Shumora can start Pi. This check does not change your installation.')}</p>
    <div className="terminal-check-actions"><Button size="sm" variant="outline" loading={busy} disabled={busy} onClick={() => void run()}>{t(busy ? 'Checking…' : error || (report && !report.launch.ok) ? 'Try again' : report ? 'Check again' : 'Check now')}</Button></div>
    {error && <p role="alert">{t(error)}</p>}
    {report && !error && <div className="terminal-check-result" role="status"><strong>{t(result)}</strong><p>{t(guidance)}</p></div>}
    {report && <>
      <div className="terminal-check-support"><Button size="sm" variant="outline" disabled={busy} onClick={() => void copy()}>{t('Copy report for support')}</Button><p>{t('Review the report before sharing. Common secrets and your home folder path are masked, but some technical details remain.')}</p></div>
      {notice && <p role="status">{t(notice)}</p>}
      <details className="diagnostic-details" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary>{t('Technical details')}</summary>
        <dl className="settings-details diagnostics-details">
          <div><dt>{t('Platform')}</dt><dd>{report.platform}</dd></div>
          <div><dt>{t('Pi version')}</dt><dd>{report.pi.version || t('Unavailable')}</dd></div>
          <div><dt>{t('Pi executable')}</dt><dd>{report.pi.executable || t('Not found')}</dd></div>
          <div><dt>{t('Installation type')}</dt><dd>{t(report.pi.installation)}</dd></div>
          <div><dt>{t('Node version')}</dt><dd>{report.node.version || t('Unavailable')}</dd></div>
          <div><dt>{t('Node executable')}</dt><dd>{report.node.executable || t('Not found')}</dd></div>
        </dl>
        <section aria-label={t('Diagnostic report')}><pre ref={reportElement} className="diagnostic-report" tabIndex={0}>{JSON.stringify(report, null, 2)}</pre></section>
      </details>
    </>}
  </section>
}
