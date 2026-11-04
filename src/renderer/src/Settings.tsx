import { ToolCacheSettings } from './ToolCacheSettings'
import { AppCheckbox } from './AppCheckbox'
import { isLanguage, useLanguage } from './Language'
import { useEffect, useState } from 'react'
import { Button } from '@chakra-ui/react'
import { useReleaseNotes } from './ReleaseNotes'
import { useAppearance } from './Appearance'
import { Updates } from './Updates'
import { Diagnostics } from './Diagnostics'
import { CouncilRolesSettings } from './CouncilRoles'
import { TerminalAgentControl } from './TerminalAgentControl'

const themes = ['light', 'dark', 'auto'] as const
const themeLabels = { light: 'Light', dark: 'Dark', auto: 'Auto' }
type Section = 'general' | 'workspace' | 'storage' | 'about'
const sections = { general: 'General', workspace: 'Workspace', storage: 'Storage', about: 'About & Updates' } as const
export function Settings({ updatesRequest = 0 }: { updatesRequest?: number }) {
  const { t, language, setLanguage } = useLanguage()
  const [section, setSection] = useState<Section>(updatesRequest ? 'about' : 'general')
  useEffect(() => { if (updatesRequest) setSection('about') }, [updatesRequest])
  const [notifications, setNotifications] = useState(true)
  const [notificationError, setNotificationError] = useState(false)
  useEffect(() => {
    let enabled = true
    try { enabled = window.localStorage.getItem('shumora.agent-notifications') !== 'false' } catch { /* Use default. */ }
    setNotifications(enabled)
    void window.workspace?.setNotificationsEnabled?.(enabled).catch(() => setNotificationError(true))
  }, [])
  async function changeNotifications(enabled: boolean) {
    try {
      await window.workspace.setNotificationsEnabled?.(enabled)
      window.localStorage.setItem('shumora.agent-notifications', String(enabled))
      setNotifications(enabled); setNotificationError(false)
    } catch { setNotificationError(true) }
  }
  const { show } = useReleaseNotes()
  const { theme, setTheme, activeLocalTheme, localThemes } = useAppearance()
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t("Settings")}</h1></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t("Settings sections")}>
        {(Object.keys(sections) as Section[]).map(id => <button key={id} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{t(sections[id])}</button>)}
      </nav>
      <section className="settings-content settings-content-wide">
        {section === 'general' && <>
          <h2>{t("General")}</h2><p>{t("Language and appearance for this device.")}</p>
          <section className="settings-section"><div className="settings-row"><div><h3 id="language-label">{t('Language')}</h3><p>{t('Choose the language used by Shumora. Terminal output and AI replies are not translated.')}</p></div><select aria-labelledby="language-label" aria-label={t('Language')} value={language} onChange={event => setLanguage(isLanguage(event.target.value) ? event.target.value : 'en')}><option value="en">English</option><option value="id">Bahasa Indonesia</option><option value="zh">中文（简体）</option></select></div></section>
          <section className="settings-section"><h3 id="theme-label">{t("Application theme")}</h3>
          <div className="theme-choices" role="radiogroup" aria-labelledby="theme-label">
            {themes.map(value => <button key={value} role="radio" aria-label={t(themeLabels[value])} aria-checked={!activeLocalTheme && theme === value} tabIndex={!activeLocalTheme && theme === value ? 0 : -1} onClick={() => setTheme(value)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
              const next = event.key === 'Home' ? themes[0] : event.key === 'End' ? themes[themes.length - 1] : themes[(themes.indexOf(value) + direction + themes.length) % themes.length]
              setTheme(next); (event.currentTarget.parentElement?.querySelector(`[aria-label="${t(themeLabels[next])}"]`) as HTMLButtonElement)?.focus()
            }} className="theme-choice">
              <span className={`theme-preview preview-${value}`} aria-hidden="true"><span /><span><i /><i /><i /></span></span>
              <span className="theme-choice-label">{t(themeLabels[value])}<span aria-hidden="true">{!activeLocalTheme && theme === value ? '●' : '○'}</span></span>
            </button>)}
          </div>
          {activeLocalTheme && <p className="settings-note">{t('Custom theme active: {name}', { name: localThemes.find(item => item.id === activeLocalTheme)?.name || activeLocalTheme })}</p>}
          <p className="settings-note">{t("Auto follows your operating system’s theme. The terminal stays dark in all modes. Changing appearance does not restart your sessions.")}</p></section>
        </>}
        {section === 'workspace' && <>
          <h2>{t('Workspace')}</h2><p>{t('Terminal behavior and tools for troubleshooting Pi.')}</p>
          <section className="settings-section"><h3>{t('Terminal')}</h3><dl className="settings-details"><div><dt>{t('Terminal appearance')}</dt><dd>{t('Always dark')}</dd></div><div><dt>{t('Runtime')}</dt><dd>{t('Installed Pi Coding Agent')}</dd></div><div><dt>{t('Session behavior')}</dt><dd>{t('Hidden sessions keep running')}</dd></div></dl><p className="settings-note">{t('Font and terminal palette controls are not available yet.')}</p></section>
          <section className="settings-section"><div className="settings-row"><div><h3>{t('Agent notifications')}</h3><p>{t('Notify when an agent finishes or fails while Shumora is in the background.')}</p></div><AppCheckbox aria-label={t('Agent notifications')} checked={notifications} onCheckedChange={checked => void changeNotifications(checked)} /></div>{notificationError && <p role="alert">{t('Could not save notification preference.')}</p>}</section>
          <TerminalAgentControl />
          <CouncilRolesSettings />
          <section className="settings-section"><Diagnostics embedded /></section>
        </>}
        {section === 'storage' && <ToolCacheSettings />}
        {section === 'about' && <>
          <h2>{t('About & Updates')}</h2><p>{t('A desktop workspace for independent Pi Coding Agent sessions.')}</p>
          <section className="settings-section"><Updates embedded /></section>
          <section className="settings-section"><div className="settings-row"><div><h3>{t('About Shumora')}</h3><p>{t('Shumora does not install Pi automatically. Model access and credentials are configured in Pi.')}</p></div><Button size="sm" variant="outline" onClick={show}>{t('Release notes')}</Button></div><div className="settings-links"><a href="https://github.com/adnannpm/Shumora" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.64 1.22 3.28.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.63 0c2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" /></svg>{t('Repository')}</a><a href="https://www.shumora.my.id/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9Z" /></svg>{t('Website')}</a></div></section>
        </>}
      </section>
    </div>
  </main>
}
