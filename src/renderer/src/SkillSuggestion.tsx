import { useEffect, useState } from 'react'
import { useLanguage } from './Language'

const preference = 'shumora.hide-skill-suggestion'
export function SkillSuggestion({ onFind }: { onFind: () => void }) {
  const { t } = useLanguage()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(preference) === 'true' } catch { return false }
  })
  useEffect(() => {
    let alive = true, changed = false
    const unsubscribe = window.workspace.onSkillsChange?.(next => { changed = true; if (alive) setCounts(next) })
    void window.workspace.skillStatus?.().then(next => { if (alive && !changed) setCounts(next) }).catch(() => {})
    return () => { alive = false; unsubscribe?.() }
  }, [])
  function dismiss(permanent = false) {
    if (permanent) { try { localStorage.setItem(preference, 'true') } catch { /* Still dismiss for this session. */ } }
    setHidden(true)
  }
  if (hidden || !Object.values(counts).includes(0)) return null
  return <aside className="skill-suggestion" aria-label={t('Optional skills')}>
    <div role="status"><strong>{t('Make your agent more capable')}</strong><p>{t('This agent has no skills loaded. Add specialized instructions, or keep working without them.')}</p></div>
    <div className="skill-suggestion-actions">
      <button type="button" onClick={() => { dismiss(); onFind() }}>{t('Find skills')} <span aria-hidden="true">→</span></button>
      <button type="button" onClick={() => dismiss()}>{t('Not now')}</button>
      <button type="button" onClick={() => dismiss(true)}>{t('Don’t show again')}</button>
    </div>
  </aside>
}
