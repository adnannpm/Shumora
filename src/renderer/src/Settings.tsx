import { useState } from 'react'
import { Button } from '@chakra-ui/react'
import { useReleaseNotes } from './ReleaseNotes'
import { releaseVersion } from './release-data'
import { useAppearance } from './Appearance'
import { Updates } from './Updates'

type Section = 'appearance' | 'terminal' | 'updates' | 'about'
export function Settings() {
  const [section, setSection] = useState<Section>('appearance')
  const { show } = useReleaseNotes()
  const { theme, setTheme } = useAppearance()
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>Settings</h1></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {(['appearance', 'terminal', 'updates', 'about'] as const).map(id => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{id === 'appearance' ? 'Appearance' : id === 'terminal' ? 'Terminal' : id === 'updates' ? 'Updates' : 'About'}</button>)}
      </nav>
      <section className="settings-content">
        {section === 'appearance' && <>
          <h2>Appearance</h2><p>Choose how Shumora looks. Your preference is saved on this device.</p>
          <h3 id="theme-label">Application theme</h3>
          <div className="theme-choices" role="radiogroup" aria-labelledby="theme-label">
            {(['light', 'dark'] as const).map(value => <button key={value} role="radio" aria-label={value === 'light' ? 'Light' : 'Dark'} aria-checked={theme === value} tabIndex={theme === value ? 0 : -1} onClick={() => setTheme(value)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
              event.preventDefault(); const next = event.key === 'Home' ? 'light' : event.key === 'End' ? 'dark' : value === 'light' ? 'dark' : 'light'
              setTheme(next); (event.currentTarget.parentElement?.querySelector(`[aria-label="${next === 'light' ? 'Light' : 'Dark'}"]`) as HTMLButtonElement)?.focus()
            }} className="theme-choice">
              <span className={`theme-preview preview-${value}`} aria-hidden="true"><span /><span><i /><i /><i /></span></span>
              <span className="theme-choice-label">{value === 'light' ? 'Light' : 'Dark'}<span aria-hidden="true">{theme === value ? '●' : '○'}</span></span>
            </button>)}
          </div>
          <p className="settings-note">The terminal stays dark in both themes. Changing appearance does not restart your sessions.</p>
        </>}
        {section === 'updates' && <Updates />}
        {section === 'terminal' && <><h2>Terminal</h2><p>The Pi terminal has its own appearance, separate from the application shell.</p><dl className="settings-details"><div><dt>Terminal appearance</dt><dd>Always dark</dd></div><div><dt>Runtime</dt><dd>Installed Pi Coding Agent</dd></div><div><dt>Session behavior</dt><dd>Hidden sessions keep running</dd></div></dl><p className="settings-note">Font and terminal palette controls are not available yet.</p></>}
        {section === 'about' && <><h2>About Shumora</h2><p>A desktop workspace for independent Pi Coding Agent sessions.</p><Button size="sm" variant="outline" onClick={show}>Release notes</Button><dl className="settings-details"><div><dt>Application</dt><dd>Shumora {releaseVersion} · early MVP</dd></div><div><dt>Agent runtime</dt><dd>External Pi installation</dd></div><div><dt>Workspace</dt><dd>Session tabs and two resizable groups</dd></div></dl><p className="settings-note">Shumora does not install Pi automatically. Model access and credentials are configured in Pi.</p></>}
      </section>
    </div>
  </main>
}
