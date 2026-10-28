import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { UpdateState } from '../../shared/updates'
import { releaseVersion } from './release-data'
export function Updates() {
  const { t } = useLanguage()
  const [state, setState] = useState<UpdateState>({ status: 'idle', currentVersion: releaseVersion })
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(0)
  const [error, setError] = useState('')
  const [installing, setInstalling] = useState(false)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!window.updates) { setState(s => ({ ...s, status: 'unsupported', reason: 'Restart Shumora to load the updated desktop bridge.' })); return }
    let alive = true, changed = false
    const unsubscribe = window.updates.onState(s => { changed = true; if (alive) setState(s) })
    void window.updates.status().then(s => { if (alive && !changed) setState(s) }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false; unsubscribe() }
  }, [])
  async function run(action: 'check' | 'download' | 'install') {
    setError('')
    if (action === 'install') { if (installing) return; setInstalling(true) }
    try { await window.updates[action](); if (action === 'install') setConfirm(false) } catch (e) { setError(String(e)); setConfirm(false) } finally { if (action === 'install') setInstalling(false) }
  }
  async function requestInstall() {
    try { const sessions = await window.workspace.list(); setRunning(sessions.filter(s => s.status === 'running').length); setConfirm(true) } catch (e) { setError(String(e)) }
  }
  const busy = ['checking', 'downloading', 'installing'].includes(state.status)
  return <>
    <h2>{t("Updates")}</h2><p>{t("Check stable GitHub Releases and install a new Shumora version when you are ready.")}</p>
    <dl className="settings-details"><div><dt>{t("Installed version")}</dt><dd>{state.currentVersion}</dd></div>{state.version && <div><dt>{t("Available version")}</dt><dd>{state.version}</dd></div>}</dl>
    {!['downloading', 'downloaded'].includes(state.status) && <div className="update-status" role="status">
      {state.status === 'idle' && t("Updates are checked only when you request them.")}
      {state.status === 'unsupported' && state.reason}
      {state.status === 'checking' && t("Checking for updates…")}
      {state.status === 'current' && t("You are using the latest available version.")}
      {state.status === 'available' && t("Shumora {version} is available.", { version: state.version || "" })}
      {state.status === 'installing' && t("Stopping sessions and restarting to install…")}
      {state.status === 'error' && t("Update failed: {error}", { error: state.error || "" })}
    </div>}
    {error && <p role="alert">{t(error)}</p>}
    {['downloading', 'downloaded'].includes(state.status) && <section className={`update-download-card${state.status === 'downloaded' ? ' is-ready' : ''}`} aria-label={t("Update download")}>
      <div className="update-download-header">
        <div className="update-download-heading"><h3 role="status">{state.status === 'downloaded' ? t("Update ready to install") : t("Downloading update")}</h3><p>{t("Shumora {version}", { version: state.version || '' })}</p></div>
        <span className="update-download-percent">{state.status === 'downloaded' ? 100 : state.percent ?? 0}%</span>
      </div>
      <progress aria-label={t("Update download progress")} max={100} value={state.status === 'downloaded' ? 100 : state.percent ?? 0} />
      <div className="update-download-footer"><p>{state.status === 'downloaded' ? t("Download complete. Install whenever you are ready.") : t("You can keep working while the update downloads.")}</p>
        {state.status === 'downloaded' && <Button className="update-primary-action" size="sm" colorPalette="brand" onClick={() => void requestInstall()}>{t("Restart & install")}</Button>}
      </div>
    </section>}
    {!['downloading', 'downloaded'].includes(state.status) && <div className="update-actions">
      <Button size="sm" variant="outline" disabled={busy || state.status === 'unsupported'} onClick={() => void run('check')}>{t("Check for updates")}</Button>
      {state.status === 'available' && <Button className="update-primary-action" size="sm" colorPalette="brand" onClick={() => void run('download')}>{t("Download update")}</Button>}
    </div>}
    {state.notes && <section className="update-release-notes"><h3>{t("Release notes")}</h3><div className="release-notes"><Markdown skipHtml components={{ a: ({ children, href }) => <span>{children}{href ? ` (${href})` : ''}</span>, img: ({ alt }) => <span>{alt}</span> }}>{state.notes}</Markdown></div></section>}
    <p className="settings-note">{t("Nothing is downloaded or installed automatically on exit. Restarting stops all Pi sessions. Save your work before installing. macOS auto-install is unavailable until release signing is configured.")}</p>
    <Dialog.Root role="alertdialog" open={confirm} onOpenChange={({ open }) => { if (!installing) setConfirm(open) }} placement="center" size="sm" initialFocusEl={() => cancel.current} closeOnInteractOutside={false}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>{t("Restart and install update?")}</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>{running ? t("{count} Pi session(s) are running and will be stopped. ", { count: running }) : ''}{t("Save your work before continuing. Workspace processes are not restored automatically.")}</Dialog.Description></Dialog.Body>
        <Dialog.Footer><Button ref={cancel} disabled={installing} variant="outline" onClick={() => setConfirm(false)}>{t("Cancel")}</Button><Button colorPalette="red" disabled={installing} loading={installing} onClick={() => void run('install')}>{t("Stop sessions and install")}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
