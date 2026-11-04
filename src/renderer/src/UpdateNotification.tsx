import { useEffect, useState } from 'react'
import type { UpdateState } from '../../shared/updates'
import { useLanguage } from './Language'

export function UpdateNotification({ onView }: { onView: () => void }) {
  const { t } = useLanguage()
  const [state, setState] = useState<UpdateState>()
  const [dismissed, setDismissed] = useState<string>()
  const [leaving, setLeaving] = useState<string>()
  useEffect(() => {
    if (!leaving) return
    const timeout = window.setTimeout(() => { setDismissed(leaving); setLeaving(undefined) }, 160)
    return () => window.clearTimeout(timeout)
  }, [leaving])
  useEffect(() => {
    const api = window.updates
    if (!api) return
    let alive = true, changed = false
    const unsubscribe = api.onState(next => { changed = true; if (alive) setState(next) })
    void api.status().then(next => {
      if (!alive || changed) return
      setState(next)
      if (next.status === 'idle') void api.check().catch(() => {})
    }).catch(() => {})
    return () => { alive = false; unsubscribe() }
  }, [])
  if (!state?.version || dismissed === state.version || !['available', 'downloaded'].includes(state.status)) return null
  const closing = leaving === state.version
  return <aside key={state.version} className={`update-notification${closing ? ' is-leaving' : ''}`} aria-label={t('Application update')}>
    <svg className="update-notification-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></svg>
    <div className="update-notification-content">
      <div role="status"><strong>{t(state.status === 'downloaded' ? 'Update ready to install' : 'New update available')}</strong><p>Shumora <span className="update-notification-version">{state.version}</span></p></div>
      <button type="button" className="update-notification-link" disabled={closing} onClick={() => { setLeaving(state.version); onView() }}>{t('View update')}<span aria-hidden="true">→</span></button>
    </div>
    <button type="button" className="update-notification-close" aria-label={t('Dismiss')} title={t('Dismiss')} disabled={closing} onClick={() => setLeaving(state.version)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
  </aside>
}
