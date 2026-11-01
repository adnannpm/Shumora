import { Button } from '@chakra-ui/react'
import { useLanguage } from './Language'

export function PluginDetailHeader({ name, onBack, onRefresh, busy }: { name: string; onBack?: () => void; onRefresh: () => void; busy: boolean }) {
  const { t } = useLanguage()
  return <header className="toolbar router-toolbar">
    <div className="router-heading">{onBack && <Button size="sm" variant="ghost" aria-label={t('Back to plugins')} title={t('Back to plugins')} onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg></Button>}<h1>{name} {t('plugin')}</h1></div>
    <Button size="sm" variant="ghost" aria-label={t('Refresh status')} title={t('Refresh status')} disabled={busy} onClick={onRefresh}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17" /></svg></Button>
  </header>
}
