import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { Button } from '@chakra-ui/react'
import { FitAddon } from '@xterm/addon-fit'
import { ImageAddon } from '@xterm/addon-image'
import { terminalTheme } from './theme'
import type { Session, SessionEvent } from '../../shared/types'

export function TerminalPane({ session, visible, focused, onFocus }: { session: Session; visible: boolean; focused: boolean; onFocus: () => void }) {
  const { t } = useLanguage()
  const host = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const fit = useRef<(() => void) | null>(null)
  const [error, setError] = useState('')
  const running = useRef(session.status === 'running')
  useEffect(() => {
    running.current = session.status === 'running'
    if (terminal.current) terminal.current.options.disableStdin = !running.current
  }, [session.status])
  useEffect(() => {
    const term = new Terminal({ disableStdin: !running.current, cursorBlink: true, fontSize: 14, fontFamily: '"Cascadia Code", "DejaVu Sans Mono", Consolas, monospace', scrollback: 5000, allowProposedApi: false, theme: terminalTheme })
    const addon = new FitAddon(); term.loadAddon(addon); term.open(host.current!)
    // Each session owns its image cache; keep memory bounded across split/hidden tabs.
    term.loadAddon(new ImageAddon({ storageLimit: 16, pixelLimit: 4_194_304 }))
    terminal.current = term
    let disposed = false, ready = false, seq = 0
    const pending: Extract<SessionEvent, { type: 'data' }>[] = []
    function apply(event: Extract<SessionEvent, { type: 'data' }>) {
      if (event.seq <= seq) return
      seq = event.seq; term.write(event.data)
    }
    const unsubscribe = window.workspace.onEvent((event) => {
      if (event.type !== 'data' || event.id !== session.id || event.generation !== session.generation) return
      if (!ready) pending.push(event)
      else apply(event)
    })
    void window.workspace.snapshot(session.id).then((snapshot) => {
      if (disposed || snapshot.session.generation !== session.generation) return
      term.write(snapshot.output); seq = snapshot.seq; ready = true
      pending.forEach(apply); pending.length = 0
    }).catch((e) => { if (!disposed) setError(String(e)) })
    const report = (e: unknown) => { if (!disposed) setError(String(e)) }
    const input = term.onData((data) => {
      if (!running.current || disposed) return
      void window.workspace.input(session.id, data).catch(report)
    })
    const resize = () => {
      if (!host.current || host.current.clientWidth < 20 || host.current.clientHeight < 20) return
      addon.fit()
      void window.workspace.resize(session.id, Math.min(1000, term.cols), Math.min(1000, term.rows)).catch(report)
    }
    fit.current = resize
    const observer = new ResizeObserver(resize); observer.observe(host.current!)
    resize()
    return () => { disposed = true; unsubscribe(); observer.disconnect(); input.dispose(); fit.current = null; terminal.current = null; term.dispose() }
  }, [session.id, session.generation])
  useEffect(() => {
    if (!visible) return
    const frame = requestAnimationFrame(() => { fit.current?.(); if (focused) terminal.current?.focus() })
    return () => cancelAnimationFrame(frame)
  }, [visible, focused])
  async function action(kind: 'stop' | 'restart') {
    setError('')
    try { await window.workspace[kind](session.id) } catch (e) { setError(String(e)) }
  }
  return <section className={`terminal-pane dark ${focused ? 'focused' : ''}`} style={{ display: visible ? 'flex' : 'none' }} onPointerDown={onFocus} aria-label={`${session.name} terminal`}>
    <div className="pane-header"><div><span className={`status-dot ${session.status}`} /><strong>{session.name}</strong><span className="pane-state">{session.status === 'running' ? t("Running") : session.status === 'error' ? t("Failed") : t("Exited")}</span><span className="pane-cwd" title={session.cwd}>{session.cwd}</span></div><Button size="xs" variant="ghost" colorPalette={session.status === 'running' ? "red" : "brand"} onClick={() => void action(session.status === 'running' ? 'stop' : 'restart')} title={session.status === 'running' ? t("Stop this session") : t("Restart this session")}>{session.status === 'running' ? t("■ Stop") : t("↻ Restart")}</Button></div>
    {(session.error || error) && <div className="terminal-error" role="alert"><strong>{t("Session needs attention")}</strong><p>{session.error || error}</p></div>}
    {session.status === 'exited' && <div className="exit-note">{t("Process exited")}{session.exitCode !== undefined ? ` (code ${session.exitCode})` : ''}{t(". Restart to begin a new Pi process; this does not resume the previous conversation.")}</div>}
    <div className="terminal-host" ref={host} />
  </section>
}
