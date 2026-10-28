import { useLanguage } from './Language'
import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { useReleaseNotes } from './ReleaseNotes'
import { releaseVersion } from './release-data'
import { useAppearance } from './Appearance'
import { Updates } from './Updates'

const themes = ['light', 'dark', 'auto'] as const
const themeLabels = { light: 'Light', dark: 'Dark', auto: 'Auto' }
type Section = 'appearance' | 'terminal' | 'updates' | 'about'
export function Settings() {
  const { t, language, setLanguage } = useLanguage()
  const [section, setSection] = useState<Section>('appearance')
  const { show } = useReleaseNotes()
  const { theme, setTheme } = useAppearance()
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t("Settings")}</h1></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t("Settings sections")}>
        {(['appearance', 'terminal', 'updates', 'about'] as const).map(id => <button key={id} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{id === 'appearance' ? t("Appearance") : id === 'terminal' ? t("Terminal") : id === 'updates' ? t("Updates") : t("About")}</button>)}
      </nav>
      <section className={`settings-content${section === 'updates' ? ' settings-content-wide' : ''}`}>
        {section === 'appearance' && <>
          <h2>{t("Appearance")}</h2><p>{t("Choose how Shumora looks. Your preference is saved on this device.")}</p>
          <label className="settings-language">{t('Language')}<select aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value === 'id' ? 'id' : 'en')}><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></label>
          <p className="settings-note">{t('Choose the language used by Shumora. Terminal output and AI replies are not translated.')}</p>
          <h3 id="theme-label">{t("Application theme")}</h3>
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
          <p className="settings-note">{t("Auto follows your operating system’s theme. The terminal stays dark in all modes. Changing appearance does not restart your sessions.")}</p>
        </>}
        {section === 'updates' && <Updates />}
        {section === 'terminal' && <><h2>{t("Terminal")}</h2><p>{t("The Pi terminal has its own appearance, separate from the application shell.")}</p><dl className="settings-details"><div><dt>{t("Terminal appearance")}</dt><dd>{t("Always dark")}</dd></div><div><dt>{t("Runtime")}</dt><dd>{t("Installed Pi Coding Agent")}</dd></div><div><dt>{t("Session behavior")}</dt><dd>{t("Hidden sessions keep running")}</dd></div></dl><p className="settings-note">{t("Font and terminal palette controls are not available yet.")}</p></>}
        {section === 'about' && <><h2>{t("About Shumora")}</h2><p>{t("A desktop workspace for independent Pi Coding Agent sessions.")}</p><Button size="sm" variant="outline" onClick={show}>{t("Release notes")}</Button><dl className="settings-details"><div><dt>{t("Application")}</dt><dd>{t("Shumora")} {releaseVersion} {t("· early MVP")}</dd></div><div><dt>{t("Agent runtime")}</dt><dd>{t("External Pi installation")}</dd></div><div><dt>{t("Workspace")}</dt><dd>{t("Session tabs and two resizable groups")}</dd></div></dl><p className="settings-note">{t("Shumora does not install Pi automatically. Model access and credentials are configured in Pi.")}</p></>}
      </section>
    </div>
  </main>
}
