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
  const running = useRef(false)
  async function run() {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setNotice(''); setReport(undefined)
    try { setReport(await window.diagnostics.run()) }
    catch { setError('Could not run diagnostics. Restart Shumora and try again.') }
    finally { running.current = false; setBusy(false) }
  }
  async function copy() {
    if (!report) return
    try { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); setNotice('Diagnostic report copied') }
    catch { setError('Could not copy diagnostic report.') }
  }
  return <>
    {embedded ? <h3>{t('Troubleshooting')}</h3> : <h2>{t('Diagnostics')}</h2>}
    <p>{t('Check how Shumora finds and starts Pi. No agent session is opened and no packages are changed.')}</p>
    <div className="update-actions"><Button size="sm" variant="outline" loading={busy} disabled={busy} onClick={() => void run()}>{t('Run diagnostics')}</Button><Button size="sm" variant="outline" disabled={!report || busy} onClick={() => void copy()}>{t('Copy diagnostic report')}</Button></div>
    <p className="settings-note">{t('Reports exclude environment secrets and mask home paths and common credential patterns. Review the report before sharing it. Version checks execute your configured Pi and Node binaries with a 10-second timeout each.')}</p>
    {busy && <p role="status">{t('Running diagnostics…')}</p>}
    {error && <p role="alert" className="plugin-error">{t(error)}</p>}
    {notice && <p role="status">{t(notice)}</p>}
    {report && <>
      <p role="status" className={report.launch.ok ? 'update-status' : 'plugin-error'}>{t(report.launch.ok ? 'Pi launch check passed' : 'Pi launch check failed')}</p>
      <dl className="settings-details diagnostics-details">
        <div><dt>{t('Platform')}</dt><dd>{report.platform}</dd></div>
        <div><dt>{t('Pi executable')}</dt><dd>{report.pi.executable || t('Not found')}</dd></div>
        <div><dt>{t('Pi version')}</dt><dd>{report.pi.version || t('Unavailable')}</dd></div>
        <div><dt>{t('Installation type')}</dt><dd>{t(report.pi.installation)}</dd></div>
        <div><dt>{t('Node executable')}</dt><dd>{report.node.executable || t('Not found')}</dd></div>
        <div><dt>{t('Node version')}</dt><dd>{report.node.version || t('Unavailable')}</dd></div>
      </dl>
      <details className="diagnostic-details"><summary>{t('Report details')}</summary><section aria-label={t('Diagnostic report')}><pre className="diagnostic-report" tabIndex={0}>{JSON.stringify(report, null, 2)}</pre></section></details>
    </>}
  </>
}
