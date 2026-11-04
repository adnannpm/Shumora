import { useState } from 'react'
import { useLanguage } from './Language'
import { useAppearance } from './Appearance'
import { parseTheme, type LocalTheme } from './local-themes'
import themeTemplate from '../../../docs/theme-template.json'

function ThemeSample({ theme }: { theme: LocalTheme }) {
  return <div className="theme-sample" aria-hidden="true" style={{ background: theme.colors.surface, borderColor: theme.colors.line, color: theme.colors.text }}>
    <div className="theme-sample-sidebar" style={{ background: theme.colors.sidebar, borderColor: theme.colors.line }}><span style={{ background: theme.colors.accent }} /><i style={{ background: theme.colors.selected }} /><i /></div>
    <div className="theme-sample-main"><div className="theme-sample-bar" style={{ borderColor: theme.colors.line }}><span /><i style={{ background: theme.colors.accent }} /></div><div className="theme-sample-lines"><span style={{ background: theme.colors.text }} /><span style={{ background: theme.colors.muted }} /><span style={{ background: theme.colors.muted }} /></div></div>
  </div>
}

export function ThemeAddons() {
  const { t } = useLanguage()
  const { localThemes, activeLocalTheme, installTheme, removeTheme, selectLocalTheme, useBuiltInTheme } = useAppearance()
  const [preview, setPreview] = useState<LocalTheme>()
  const [error, setError] = useState('')
  async function importFile(file?: File) {
    setPreview(undefined); setError('')
    if (!file) return
    if (file.size > 65536) { setError('Theme file is too large (maximum 64 KB).'); return }
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Could not read theme file.'))
        reader.readAsText(file)
      })
      setPreview(parseTheme(raw))
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(themeTemplate, null, 2) + '\n'], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'shumora-theme-template.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function install() {
    if (!preview) return
    try { installTheme(preview); setPreview(undefined); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  return <section className="theme-addons">
    <header className="theme-addons-heading"><div><h2>{t('Themes')}</h2><p>{t('Change the look of Shumora. Terminal colors stay the same.')}</p></div><label className="theme-import-button">{t('Import theme JSON')}<input type="file" accept=".json,application/json" aria-label={t('Import theme JSON')} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = '' }} /></label></header>
    <p className="theme-addons-hint">{t('Start with the template, edit its colors, then import the JSON file.')} <button type="button" onClick={downloadTemplate}>{t('Download template')} ↓</button></p>
    {error && <p role="alert" className="plugin-error">{t(error)}</p>}
    {preview && <section className="theme-addon-card theme-addon-preview" aria-label={t('Theme preview')}>
      <ThemeSample theme={preview} />
      <div className="theme-addon-info"><small>{t('Preview · Not installed')}</small><h3>{preview.name}</h3><p>{t(preview.mode === 'dark' ? 'Dark theme' : 'Light theme')}</p></div>
      <button type="button" onClick={install}>{t(localThemes.some(item => item.id === preview.id) ? 'Replace theme' : 'Install theme')}</button>
    </section>}
    <div className="theme-addons-list">
      <div className="theme-addons-section-title"><h3>{t('Installed themes')}</h3><span>{localThemes.length}</span></div>
      <div className="theme-addon-card theme-built-in-row"><div className="theme-built-in-mark" aria-hidden="true">◐</div><div className="theme-addon-info"><h4>{t('Shumora default')}</h4><p>{t('Light, dark, or system setting')}</p></div>{activeLocalTheme ? <button type="button" className="theme-built-in" onClick={useBuiltInTheme}>{t('Use built-in theme')}</button> : <span className="theme-active-label">{t('Active')}</span>}</div>
      {!localThemes.length && <p className="theme-addons-empty">{t('No custom themes yet. Import a JSON file to add one.')}</p>}
      {localThemes.map(item => <article className="theme-addon-card" key={item.id}>
        <ThemeSample theme={item} />
        <div className="theme-addon-info"><h4>{item.name}</h4><p>{t(item.mode === 'dark' ? 'Dark theme' : 'Light theme')}{activeLocalTheme === item.id ? ` · ${t('Active')}` : ''}</p></div>
        <div className="theme-addon-actions"><button type="button" disabled={activeLocalTheme === item.id} onClick={() => selectLocalTheme(item.id)}>{t('Activate {name}', { name: item.name })}</button><button type="button" className="theme-remove" onClick={() => removeTheme(item.id)}>{t('Remove {name}', { name: item.name })}</button></div>
      </article>)}
    </div>
  </section>
}
