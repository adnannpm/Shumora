import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { Session } from '../../shared/types'
import { TerminalPane } from './TerminalPane'
import { Sidebar, type Page } from './Sidebar'
import { Settings } from './Settings'
import { initialLayout, layoutReducer, type Layout } from './layout'

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [page, setPage] = useState<Page>('workspace')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [layout, dispatch] = useReducer(layoutReducer, initialLayout)
  const [folder, setFolder] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ratio, setRatio] = useState(50)
  const [closing, setClosing] = useState<string[]>([])
  const [closeTarget, setCloseTarget] = useState<Session | null>(null)
  const cancelClose = useRef<HTMLButtonElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const split = layout.groups.length === 2
  useEffect(() => {
    let disposed = false
    let loaded = false
    const pending: import('../../shared/types').SessionEvent[] = []
    function apply(event: import('../../shared/types').SessionEvent) {
      if (event.type === 'data') return
      if (event.type === 'removed') {
        setSessions(list => list.filter(s => s.id !== event.id)); dispatch({ type: 'remove', id: event.id })
      } else setSessions(list => list.some(s => s.id === event.session.id) ? list.map(s => s.id === event.session.id ? event.session : s) : [...list, event.session])
    }
    const unsubscribe = window.workspace.onEvent(event => { if (!loaded) pending.push(event); else apply(event) })
    void Promise.all([window.workspace.list(), window.workspace.folder()]).then(([list, cwd]) => {
      if (disposed) return
      setSessions(list); setFolder(cwd); dispatch({ type: 'init', ids: list.map(s => s.id) })
      loaded = true; pending.forEach(apply)
    }).catch(e => { if (!disposed) setError(String(e)) })
    return () => { disposed = true; unsubscribe() }
  }, [])
  async function add(group = layout.focused, orientation?: Layout['orientation']) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const session = await window.workspace.create()
      setSessions(list => list.some(s => s.id === session.id) ? list.map(s => s.id === session.id ? session : s) : [...list, session])
      if (orientation) { dispatch({ type: 'split', orientation, newId: session.id }); setRatio(50) }
      else dispatch({ type: 'add', id: session.id, group })
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function close(id: string) {
    if (closing.includes(id)) return
    setClosing(ids => [...ids, id])
    try {
      if (await window.workspace.close(id)) {
        setSessions(list => list.filter(s => s.id !== id)); dispatch({ type: 'remove', id })
        setCloseTarget(null)
      }
    } catch (e) { setError(String(e)) } finally { setClosing(ids => ids.filter(i => i !== id)) }
  }
  function doSplit(orientation: Layout['orientation']) {
    if (!split && layout.groups[0].ids.length === 1) { void add(0, orientation); return }
    dispatch({ type: 'split', orientation }); setRatio(50)
  }
  function position(index: number, row: number): CSSProperties {
    return layout.orientation === 'right' ? { gridColumn: index * 2 + 1, gridRow: row } : { gridColumn: 1, gridRow: index * 3 + row }
  }
  function resize(clientX: number, clientY: number) {
    const rect = area.current?.getBoundingClientRect()
    if (!rect) return
    const value = layout.orientation === 'right' ? (clientX - rect.left) / rect.width : (clientY - rect.top) / rect.height
    setRatio(Math.round(Math.max(25, Math.min(75, value * 100))))
  }
  const gridStyle: CSSProperties = !split ? { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: '42px minmax(0, 1fr)' }
    : layout.orientation === 'right' ? { gridTemplateColumns: `minmax(0, ${ratio}fr) 6px minmax(0, ${100 - ratio}fr)`, gridTemplateRows: '42px minmax(0, 1fr)' }
    : { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: `42px minmax(0, ${ratio}fr) 6px 42px minmax(0, ${100 - ratio}fr)` }
  const needsPartner = !split && layout.groups[0].ids.length === 1
  return <div className="workspace flex h-dvh overflow-hidden">
    <Sidebar page={page} onPage={setPage} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />
    <main className="flex min-w-0 flex-1 flex-col" style={{ display: page === 'workspace' ? 'flex' : 'none' }}>
      <header className="toolbar">
        <h1>AI Workspace</h1>
        <button className="folder-button workspace-folder" title="Working directory for new sessions" aria-label="Choose folder for new sessions" onClick={() => { void window.workspace.chooseFolder().then(setFolder).catch(e => setError(String(e))) }}><span aria-hidden="true">▱</span><span title={folder}>{folder || 'Loading folder…'}</span></button>
        <div className="layout-switch" aria-label="Terminal layout">
          <Button size="xs" variant="ghost" disabled={busy || !sessions.length} aria-label={needsPartner ? 'New session in split right' : 'Split right'} onClick={() => doSplit('right')}>{needsPartner ? '+ Split right' : 'Split right'}</Button>
          <Button size="xs" variant="ghost" disabled={busy || !sessions.length} aria-label={needsPartner ? 'New session in split down' : 'Split down'} onClick={() => doSplit('down')}>{needsPartner ? '+ Split down' : 'Split down'}</Button>
          {split && <Button size="xs" variant="ghost" onClick={() => dispatch({ type: 'merge' })}>Merge groups</Button>}
        </div>
      </header>
      {error && <div className="global-error" role="alert">{error}<Button size="xs" variant="ghost" colorPalette="red" onClick={() => setError('')}>Dismiss</Button></div>}
      <div className={`tab-workspace ${split ? `split-${layout.orientation}` : ''}`} style={gridStyle} ref={area}>
        {layout.groups.map((group, index) => <div key={`group-${index}`} className={`tab-group-bar ${layout.focused === index ? 'active-group' : ''}`} style={position(index, 1)} onPointerDown={() => dispatch({ type: 'focus', group: index })}>
          <div className="session-tablist" role="tablist" aria-label={`Session group ${index + 1}`} onKeyDown={event => {
            const current = group.ids.indexOf(group.active)
            const next = event.key === 'ArrowRight' ? (current + 1) % group.ids.length : event.key === 'ArrowLeft' ? (current - 1 + group.ids.length) % group.ids.length : event.key === 'Home' ? 0 : event.key === 'End' ? group.ids.length - 1 : -1
            if (next < 0) return
            event.preventDefault(); dispatch({ type: 'select', group: index, id: group.ids[next] })
            document.getElementById(`tab-${group.ids[next]}`)?.focus()
          }}>
            {group.ids.map(id => { const s = sessions.find(s => s.id === id); if (!s) return null
              return <div className={`session-tab ${group.active === id ? 'selected' : ''}`} key={id}>
                <button role="tab" id={`tab-${id}`} aria-selected={group.active === id} aria-controls={`panel-${id}`} tabIndex={group.active === id ? 0 : -1} onClick={() => dispatch({ type: 'select', group: index, id })}><span className={`status-dot ${s.status}`} aria-hidden="true" />{s.name}</button>
                <button className="close-tab" aria-label={`Close ${s.name}`} title={`Close ${s.name}`} disabled={closing.includes(id)} onClick={() => { if (s.status === 'running') setCloseTarget(s); else void close(id) }}>×</button>
              </div>
            })}
          </div>
          <Button size="xs" variant="ghost" flexShrink="0" aria-label={`New session in group ${index + 1}`} title="New session" disabled={busy} onClick={() => void add(index)}>＋</Button>
          {split && <Button size="xs" variant="ghost" flexShrink="0" aria-label={`Move active tab from group ${index + 1} to other group`} title="Move active tab to other group" disabled={busy} onClick={() => dispatch({ type: 'move', group: index })}>⇄</Button>}
        </div>)}
        {sessions.map(session => {
          const index = layout.groups.findIndex(g => g.ids.includes(session.id))
          const visible = index >= 0 && layout.groups[index].active === session.id
          return <div key={session.id} id={`panel-${session.id}`} role="tabpanel" aria-labelledby={`tab-${session.id}`} className="session-panel" style={{ ...position(Math.max(0, index), 2), display: visible ? 'flex' : 'none' }}>
            <TerminalPane session={session} visible={visible && page === 'workspace'} focused={visible && page === 'workspace' && layout.focused === index} onFocus={() => dispatch({ type: 'focus', group: index })} />
          </div>
        })}
        {split && <div className="group-separator" role="separator" tabIndex={0} aria-label="Resize terminal groups" aria-orientation={layout.orientation === 'right' ? 'vertical' : 'horizontal'} aria-valuemin={25} aria-valuemax={75} aria-valuenow={ratio} style={layout.orientation === 'right' ? { gridColumn: 2, gridRow: '1 / 3' } : { gridColumn: 1, gridRow: 3 }}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientX, event.clientY) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          onDoubleClick={() => setRatio(50)}
          onKeyDown={event => {
            const less = layout.orientation === 'right' ? 'ArrowLeft' : 'ArrowUp'
            const more = layout.orientation === 'right' ? 'ArrowRight' : 'ArrowDown'
            if (![less, more, 'Home', 'End'].includes(event.key)) return
            event.preventDefault(); setRatio(value => event.key === 'Home' ? 25 : event.key === 'End' ? 75 : Math.max(25, Math.min(75, value + (event.key === more ? 5 : -5))))
          }} />}
        {!sessions.length && <div className="empty-state" style={position(0, 2)}><div><h2>No open sessions</h2><p>Create a Pi session to start working.</p><Button colorPalette="brand" size="sm" disabled={busy} onClick={() => void add(0)}>New session</Button></div></div>}
      </div>
      <footer className="statusbar"><span>{sessions.filter(s => s.status === 'running').length} processes running</span><span>{split ? 'Two groups' : 'Single group'} · Hidden sessions keep running</span></footer>
    </main>
    {page === 'settings' && <Settings />}
    <Dialog.Root role="alertdialog" open={closeTarget !== null} placement="center" size="sm" initialFocusEl={() => cancelClose.current} closeOnInteractOutside={false} onOpenChange={({ open }) => { if (!open && !closing.length) setCloseTarget(null) }}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>Close {closeTarget?.name}?</Dialog.Title></Dialog.Header>
            <Dialog.Body><Dialog.Description>This stops the Pi process and removes its tab. Any active work will be interrupted. Switch tabs instead to keep the session running.</Dialog.Description></Dialog.Body>
            <Dialog.Footer>
              <Button ref={cancelClose} variant="outline" disabled={closing.length > 0} onClick={() => setCloseTarget(null)}>Cancel</Button>
              <Button colorPalette="red" loading={closing.length > 0} loadingText="Closing…" disabled={closing.length > 0} onClick={() => { if (closeTarget) void close(closeTarget.id) }}>Stop and close</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  </div>
}
