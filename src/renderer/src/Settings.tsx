import { useLanguage } from './Language'
import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { useReleaseNotes } from './ReleaseNotes'
import { useAppearance } from './Appearance'
import { Updates } from './Updates'
import { Diagnostics } from './Diagnostics'

const themes = ['light', 'dark', 'auto'] as const
const themeLabels = { light: 'Light', dark: 'Dark', auto: 'Auto' }
type Section = 'general' | 'workspace' | 'about'
const sections = { general: 'General', workspace: 'Workspace', about: 'About & Updates' } as const
export function Settings() {
  const { t, language, setLanguage } = useLanguage()
  const [section, setSection] = useState<Section>('general')
  const { show } = useReleaseNotes()
  const { theme, setTheme } = useAppearance()
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t("Settings")}</h1></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t("Settings sections")}>
        {(Object.keys(sections) as Section[]).map(id => <button key={id} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{t(sections[id])}</button>)}
      </nav>
      <section className="settings-content settings-content-wide">
        {section === 'general' && <>
          <h2>{t("General")}</h2><p>{t("Language and appearance for this device.")}</p>
          <section className="settings-section"><div className="settings-row"><div><h3 id="language-label">{t('Language')}</h3><p>{t('Choose the language used by Shumora. Terminal output and AI replies are not translated.')}</p></div><select aria-labelledby="language-label" aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value === 'id' ? 'id' : 'en')}><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></div></section>
          <section className="settings-section"><h3 id="theme-label">{t("Application theme")}</h3>
          <div className="theme-choices" role="radiogroup" aria-labelledby="theme-label">
            {themes.map(value => <button key={value} role="radio" aria-label={t(themeLabels[value])} aria-checked={theme === value} tabIndex={theme === value ? 0 : -1} onClick={() => setTheme(value)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
              const next = event.key === 'Home' ? themes[0] : event.key === 'End' ? themes[themes.length - 1] : themes[(themes.indexOf(value) + direction + themes.length) % themes.length]
              setTheme(next); (event.currentTarget.parentElement?.querySelector(`[aria-label="${t(themeLabels[next])}"]`) as HTMLButtonElement)?.focus()
            }} className="theme-choice">
              <span className={`theme-preview preview-${value}`} aria-hidden="true"><span /><span><i /><i /><i /></span></span>
              <span className="theme-choice-label">{t(themeLabels[value])}<span aria-hidden="true">{theme === value ? '●' : '○'}</span></span>
            </button>)}
          </div>
          <p className="settings-note">{t("Auto follows your operating system’s theme. The terminal stays dark in all modes. Changing appearance does not restart your sessions.")}</p></section>
        </>}
        {section === 'workspace' && <>
          <h2>{t('Workspace')}</h2><p>{t('Terminal behavior and tools for troubleshooting Pi.')}</p>
          <section className="settings-section"><h3>{t('Terminal')}</h3><dl className="settings-details"><div><dt>{t('Terminal appearance')}</dt><dd>{t('Always dark')}</dd></div><div><dt>{t('Runtime')}</dt><dd>{t('Installed Pi Coding Agent')}</dd></div><div><dt>{t('Session behavior')}</dt><dd>{t('Hidden sessions keep running')}</dd></div></dl><p className="settings-note">{t('Font and terminal palette controls are not available yet.')}</p></section>
          <section className="settings-section"><Diagnostics embedded /></section>
        </>}
        {section === 'about' && <>
          <h2>{t('About & Updates')}</h2><p>{t('A desktop workspace for independent Pi Coding Agent sessions.')}</p>
          <section className="settings-section"><Updates embedded /></section>
          <section className="settings-section"><div className="settings-row"><div><h3>{t('About Shumora')}</h3><p>{t('Shumora does not install Pi automatically. Model access and credentials are configured in Pi.')}</p></div><Button size="sm" variant="outline" onClick={show}>{t('Release notes')}</Button></div><div className="settings-links"><a href="https://github.com/adnannpm/Shumora" target="_blank" rel="noopener noreferrer">{t('Repository')}</a></div></section>
        </>}
      </section>
    </div>
  </main>
}
