import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { UpdateState } from '../../shared/updates'
import { releaseVersion } from './release-data'
export function Updates() {
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
    <h2>Updates</h2><p>Check stable GitHub Releases and install a new Shumora version when you are ready.</p>
    <dl className="settings-details"><div><dt>Installed version</dt><dd>{state.currentVersion}</dd></div>{state.version && <div><dt>Available version</dt><dd>{state.version}</dd></div>}</dl>
    <div className="update-status" role="status">
      {state.status === 'idle' && 'Updates are checked only when you request them.'}
      {state.status === 'unsupported' && state.reason}
      {state.status === 'checking' && 'Checking for updates…'}
      {state.status === 'current' && 'You are using the latest available version.'}
      {state.status === 'available' && `Shumora ${state.version} is available.`}
      {state.status === 'downloading' && `Downloading update… ${state.percent ?? 0}%`}
      {state.status === 'downloaded' && 'Update downloaded. Restart to install it.'}
      {state.status === 'installing' && 'Stopping sessions and restarting to install…'}
      {state.status === 'error' && `Update failed: ${state.error}`}
    </div>
    {error && <p role="alert">{error}</p>}
    {state.status === 'downloading' && <progress aria-label="Update download progress" max={100} value={state.percent ?? 0} />}
    <div className="update-actions">
      <Button size="sm" variant="outline" disabled={busy || state.status === 'unsupported' || state.status === 'downloaded'} onClick={() => void run('check')}>Check for updates</Button>
      {state.status === 'available' && <Button size="sm" colorPalette="brand" onClick={() => void run('download')}>Download update</Button>}
      {state.status === 'downloaded' && <Button size="sm" colorPalette="brand" onClick={() => void requestInstall()}>Restart &amp; install</Button>}
    </div>
    {state.notes && <section className="update-release-notes"><h3>Release notes</h3><div className="release-notes"><Markdown skipHtml components={{ a: ({ children, href }) => <span>{children}{href ? ` (${href})` : ''}</span>, img: ({ alt }) => <span>{alt}</span> }}>{state.notes}</Markdown></div></section>}
    <p className="settings-note">Nothing is downloaded or installed automatically on exit. Restarting stops all Pi sessions. Save your work before installing. macOS auto-install is unavailable until release signing is configured.</p>
    <Dialog.Root role="alertdialog" open={confirm} onOpenChange={({ open }) => { if (!installing) setConfirm(open) }} placement="center" size="sm" initialFocusEl={() => cancel.current} closeOnInteractOutside={false}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>Restart and install update?</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>{running ? `${running} Pi session(s) are running and will be stopped. ` : ''}Save your work before continuing. Workspace processes are not restored automatically.</Dialog.Description></Dialog.Body>
        <Dialog.Footer><Button ref={cancel} disabled={installing} variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button colorPalette="red" disabled={installing} loading={installing} onClick={() => void run('install')}>Stop sessions and install</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </>
}
