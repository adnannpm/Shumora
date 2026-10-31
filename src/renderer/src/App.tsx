import { useLanguage } from './Language'
import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { Session } from '../../shared/types'
import { TerminalPane } from './TerminalPane'
import { GitReviewButton } from './GitReview'
import { Sidebar, type Page } from './Sidebar'
import { Settings } from './Settings'
import { MeetingRoom } from './MeetingRoom'
import { Library } from './Library'
import { WorkspaceSetup } from './WorkspaceSetup'
import { GitAskPassModal } from './GitAskPassModal'
import { RouterDashboard } from './RouterDashboard'
import type { RouterPlugin } from '../../shared/plugins'
import { initialLayout, layoutReducer, layoutRects, type Layout } from './layout'

export default function App() {
  const { t } = useLanguage()
  const [sessions, setSessions] = useState<Session[]>([])
  const [unread, setUnread] = useState<string[]>([])
  useEffect(() => {
    let enabled = true
    try { enabled = window.localStorage.getItem('shumora.agent-notifications') !== 'false' } catch { /* Use default. */ }
    void window.workspace?.setNotificationsEnabled?.(enabled).catch(() => {})
  }, [])
  const [page, setPage] = useState<Page>('workspace')
  const [setupPlugin, setSetupPlugin] = useState<'pi' | 'opencode' | '9router' | 'node' | 'pnpm' | 'bun' | 'yarn' | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [routerInstalled, setRouterInstalled] = useState(false)
  function pluginStatus(plugin: RouterPlugin) {
    if (plugin.error?.startsWith('Cannot verify local')) return
    setRouterInstalled(plugin.installed)
    if (!plugin.installed) setPage(current => current === '9router' ? 'workspace' : current)
  }
  useEffect(() => {
    let alive = true
    const check = () => { void window.plugins?.status().then(plugin => { if (alive) pluginStatus(plugin) }).catch(() => {}) }
    check(); window.addEventListener('focus', check)
    return () => { alive = false; window.removeEventListener('focus', check) }
  }, [])
  const [layout, dispatch] = useReducer(layoutReducer, initialLayout)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  useEffect(() => {
    if (!workspaceLoaded) return
    try { window.localStorage.setItem('shumora.terminal-layout', JSON.stringify(layout)) } catch { /* Storage may be unavailable. */ }
  }, [layout, workspaceLoaded])
  const visibleState = useRef({ page, layout })
  visibleState.current = { page, layout }
  useEffect(() => {
    if (page === 'workspace') setUnread(ids => ids.filter(id => !layout.groups.some(group => group.active === id)))
  }, [page, layout])
  const [folder, setFolder] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState<number | null>(null)
  const [closing, setClosing] = useState<string[]>([])
  const [closeTarget, setCloseTarget] = useState<Session | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [tabMenu, setTabMenu] = useState<{ id: string; group: number; x: number; y: number } | null>(null)
  const tabMenuElement = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tabMenu) return
    const menu = tabMenuElement.current!
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(tabMenu.x, window.innerWidth - rect.width - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(tabMenu.y, window.innerHeight - rect.height - 8))}px`
    menu.querySelector<HTMLButtonElement>('button')?.focus()
    function dismiss(event: Event) {
      const target = event.target as HTMLElement
      if (!menu.contains(target) && !target.closest('[role="tab"]')) setTabMenu(null)
    }
    const dismissOnBlur = () => setTabMenu(null)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('click', dismiss)
    window.addEventListener('blur', dismissOnBlur)
    window.addEventListener('resize', dismissOnBlur)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('click', dismiss)
      window.removeEventListener('blur', dismissOnBlur)
      window.removeEventListener('resize', dismissOnBlur)
    }
  }, [tabMenu])
  useEffect(() => { setTabMenu(null) }, [page, layout.tree])
  useEffect(() => {
    if (tabMenu && !sessions.some(session => session.id === tabMenu.id)) setTabMenu(null)
  }, [sessions, tabMenu])
  const renameDone = useRef(false)
  function finishRename(save: boolean, focusTab = false) {
    if (!renaming || renameDone.current) return
    renameDone.current = true
    const { id, name } = renaming
    setRenaming(null)
    if (focusTab) requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus())
    if (!save || !name.trim()) return
    void window.workspace.rename(id, name.trim()).then(session => {
      setSessions(list => list.map(s => s.id === id ? { ...s, name: session.name } : s))
    }).catch(e => setError(String(e)))
  }
  const cancelClose = useRef<HTMLButtonElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const slide = useRef<{ id: string; group: number; startX: number; pointer: number; moved: boolean; element: HTMLDivElement } | null>(null)
  const [sliding, setSliding] = useState<{ id: string; offset: number } | null>(null)
  function slideTab(event: React.PointerEvent<HTMLDivElement>) {
    const current = slide.current
    if (!current || current.pointer !== event.pointerId) return
    const delta = event.clientX - current.startX
    if (!current.moved && Math.abs(delta) < 6) return
    if (!current.moved) {
      current.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const list = event.currentTarget.parentElement!
    const rect = event.currentTarget.getBoundingClientRect()
    const bounds = list.getBoundingClientRect()
    setSliding({ id: current.id, offset: Math.max(bounds.left - (rect.left - (sliding?.offset || 0)), Math.min(delta, bounds.right - (rect.right - (sliding?.offset || 0)))) })
    const ids = layout.groups[current.group].ids
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('.session-tab'))
    const target = tabs.find(tab => {
      if (tab.dataset.sessionId === current.id) return false
      const box = tab.getBoundingClientRect()
      return event.clientX >= box.left && event.clientX <= box.right
    })
    if (!target) return
    const box = target.getBoundingClientRect()
    const targetId = target.dataset.sessionId!
    const sourceIndex = ids.indexOf(current.id), targetIndex = ids.indexOf(targetId)
    if (targetIndex > sourceIndex && event.clientX > box.left + box.width / 2) {
      dispatch({ type: 'drop', id: current.id, group: current.group, before: ids[targetIndex + 1] })
    } else if (targetIndex < sourceIndex && event.clientX < box.left + box.width / 2) {
      dispatch({ type: 'drop', id: current.id, group: current.group, before: targetId })
    } else return
    current.startX = event.clientX
    setSliding({ id: current.id, offset: 0 })
  }
  function endSlide() {
    const current = slide.current
    slide.current = null; setSliding(null)
    if (current?.moved && current.element.hasPointerCapture?.(current.pointer)) current.element.releasePointerCapture(current.pointer)
  }
  useEffect(() => {
    window.addEventListener('blur', endSlide)
    return () => { window.removeEventListener('blur', endSlide) }
  }, [])
  useEffect(() => { endSlide() }, [page])
  const split = layout.groups.length > 1
  useEffect(() => {
    let disposed = false
    let loaded = false
    const pending: import('../../shared/types').SessionEvent[] = []
    function apply(event: import('../../shared/types').SessionEvent) {
      if (event.type === 'data') return
      if (event.type === 'activity') {
        setSessions(list => list.map(session => session.id === event.id && session.generation === event.generation ? { ...session, activity: event.activity } : session))
        const view = visibleState.current
        if (['done', 'error'].includes(event.activity) && (view.page !== 'workspace' || !view.layout.groups.some(group => group.active === event.id))) {
          setUnread(ids => ids.includes(event.id) ? ids : [...ids, event.id])
        }
        return
      }
      if (event.type === 'opened') {
        setSessions(list => list.some(s => s.id === event.session.id) ? list : [...list, event.session])
        dispatch({ type: 'add', id: event.session.id, group: 0 })
        setSetupPlugin(null); setPage('workspace')
        return
      }
      if (event.type === 'removed') {
        setSessions(list => list.filter(s => s.id !== event.id)); dispatch({ type: 'remove', id: event.id })
      } else setSessions(list => list.some(s => s.id === event.session.id) ? list.map(s => s.id === event.session.id ? event.session : s) : [...list, event.session])
    }
    const unsubscribe = window.workspace.onEvent(event => { if (!loaded) pending.push(event); else apply(event) })
    void Promise.all([window.workspace.list(), window.workspace.folder()]).then(([list, cwd]) => {
      if (disposed) return
      let saved: unknown
      try { saved = JSON.parse(window.localStorage.getItem('shumora.terminal-layout') || 'null') } catch { /* Use the default layout. */ }
      setSessions(list); setFolder(cwd); dispatch({ type: 'init', ids: list.map(s => s.id), saved })
      loaded = true; pending.forEach(apply)
      setWorkspaceLoaded(true)
    }).catch(e => { if (!disposed) setError(String(e)) })
    return () => { disposed = true; unsubscribe() }
  }, [])
  const activeSession = sessions.find(s => s.id === layout.groups[layout.focused]?.active)
  function groupFolder(group: number) {
    return sessions.find(s => s.id === layout.groups[group]?.active)?.cwd || folder
  }
  function requestSession(group = layout.focused, orientation?: Layout['orientation'], chooseFolder = false) {
    void add(group, orientation, chooseFolder)
  }
  async function add(group = layout.focused, orientation?: Layout['orientation'], chooseFolder = false, selectedFolder?: string, reportToModal = false) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const cwd = selectedFolder ?? (chooseFolder ? await window.workspace.chooseFolder(groupFolder(group)) : groupFolder(group))
      if (cwd === null) return
      setCreatingGroup(group)
      const session = await window.workspace.create(cwd)
      if (session.status === 'error') throw new Error(session.error || 'Could not start the Pi session')
      setSessions(list => list.some(s => s.id === session.id) ? list.map(s => s.id === session.id ? session : s) : [...list, session])
      if (orientation) { dispatch({ type: 'split', orientation, group, newId: session.id }) }
      else dispatch({ type: 'add', id: session.id, group })
    } catch (e) { if (reportToModal) throw e; setError(String(e)) } finally { setBusy(false); setCreatingGroup(null) }
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
    if (layout.groups.length >= 4) return
    if (layout.groups[layout.focused].ids.length === 1) { requestSession(layout.focused, orientation); return }
    dispatch({ type: 'split', orientation })
  }
  const { panes, separators } = layoutRects(layout.tree)
  function position(index: number, row: number): CSSProperties {
    const rect = panes[index] || panes[0]
    const leftGap = rect.left > 0 ? 3 : 0, topGap = rect.top > 0 ? 3 : 0
    const horizontalGap = leftGap + (rect.left + rect.width < 99.99 ? 3 : 0)
    const verticalGap = topGap + (rect.top + rect.height < 99.99 ? 3 : 0)
    return { position: 'absolute', left: `calc(${rect.left}% + ${leftGap}px)`, width: `calc(${rect.width}% - ${horizontalGap}px)`, top: `calc(${rect.top}% + ${topGap + (row === 2 ? 42 : 0)}px)`, height: row === 1 ? 42 : `calc(${rect.height}% - ${verticalGap + 42}px)` }
  }
  function resize(separator: typeof separators[number], clientX: number, clientY: number) {
    const rect = area.current?.getBoundingClientRect()
    if (!rect) return
    const bounds = separator.bounds, right = separator.orientation === 'right'
    const point = right ? (clientX - rect.left) / rect.width * 100 : (clientY - rect.top) / rect.height * 100
    const value = (point - (right ? bounds.left : bounds.top)) / (right ? bounds.width : bounds.height) * 100
    dispatch({ type: 'resize', path: separator.path, ratio: Math.round(value) })
  }
  const needsPartner = layout.groups[layout.focused].ids.length === 1
  const focusedSession = sessions.find(s => s.id === layout.groups[layout.focused]?.active)
  return <div className="workspace flex h-dvh overflow-hidden">
    <Sidebar routerInstalled={routerInstalled} page={page} onPage={value => { setSetupPlugin(null); setPage(value) }} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />
    <main className="flex min-w-0 flex-1 flex-col" style={{ display: page === 'workspace' ? 'flex' : 'none' }}>
      <header className="toolbar">       
        <h1>{t("Terminals")}</h1>
        <button className="folder-button workspace-folder" title={t("Active terminal folder. Click to open a new terminal in another folder.")} aria-label={t("New terminal in folder…")} disabled={busy} onClick={() => requestSession(layout.focused, undefined, true)}><span aria-hidden="true">▱</span><span title={activeSession?.cwd || folder}>{activeSession?.cwd || folder || t("Loading folder…")}</span></button>
        {focusedSession && <GitReviewButton key={focusedSession.id} sessionId={focusedSession.id} sessionName={focusedSession.name} sessions={sessions} visible={page === 'workspace'} />}
        <div className="layout-switch" role="group" aria-label={t("Terminal layout")}>
          <button type="button" className="layout-icon-button" disabled={busy || !sessions.length || layout.groups.length >= 4} aria-label={needsPartner ? t("New session in split right") : t("Split right")} title={needsPartner ? t("New session in split right") : t("Split right")} onClick={() => doSplit('right')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M12 4v16" /></svg>
          </button>
          <button type="button" className="layout-icon-button" disabled={busy || !sessions.length || layout.groups.length >= 4} aria-label={needsPartner ? t("New session in split down") : t("Split down")} title={needsPartner ? t("New session in split down") : t("Split down")} onClick={() => doSplit('down')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 12h18" /></svg>
          </button>
          {split && <><span className="layout-switch-divider" aria-hidden="true" /><button type="button" className="layout-icon-button" aria-label={t("Merge groups")} title={t("Merge groups")} onClick={() => dispatch({ type: 'merge' })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="m7 10 2 2-2 2m10-4-2 2 2 2M5 12h4m6 0h4" /></svg>
          </button></>}
        </div>
      </header>
      {error && <div className="global-error" role="alert">{t(error)}<Button size="xs" variant="ghost" colorPalette="red" onClick={() => setError('')}>{t("Dismiss")}</Button></div>}
      <div className="tab-workspace" ref={area}>
        {creatingGroup !== null && <div className="terminal-create-loading" style={position(creatingGroup, 1)}><span className="terminal-loading-spinner" role="progressbar" aria-label={t('Loading terminal')} /></div>}
        {layout.groups.map((group, index) => <div key={`group-${index}`} className={`tab-group-bar ${layout.focused === index ? 'active-group' : ''}`} style={position(index, 1)} onPointerDown={() => dispatch({ type: 'focus', group: index })}>
          <div className="session-tablist" role="tablist" aria-label={t("Session group {number}", { number: index + 1 })} onKeyDown={event => {
            if ((event.target as HTMLElement).tagName === 'INPUT') return
            const current = group.ids.indexOf(group.active)
            const next = event.key === 'ArrowRight' ? (current + 1) % group.ids.length : event.key === 'ArrowLeft' ? (current - 1 + group.ids.length) % group.ids.length : event.key === 'Home' ? 0 : event.key === 'End' ? group.ids.length - 1 : -1
            if (next < 0) return
            event.preventDefault(); dispatch({ type: 'select', group: index, id: group.ids[next] })
            document.getElementById(`tab-${group.ids[next]}`)?.focus()
          }}>
            {group.ids.map(id => { const s = sessions.find(s => s.id === id); if (!s) return null
              return <div className={`session-tab ${group.active === id ? 'selected' : ''} ${sliding?.id === id ? 'sliding' : ''}`} key={id} data-session-id={id} style={sliding?.id === id ? { transform: `translateX(${sliding.offset}px)` } : undefined} onDragStart={event => event.preventDefault()} onPointerDown={event => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('.close-tab, input')) return
                setTabMenu(null)
                slide.current = { id, group: index, startX: event.clientX, pointer: event.pointerId, moved: false, element: event.currentTarget }
              }} onPointerMove={slideTab} onPointerUp={event => { if (slide.current?.pointer === event.pointerId) { dispatch({ type: 'select', group: index, id }); endSlide() } }} onPointerCancel={endSlide} onLostPointerCapture={endSlide}>
                {renaming?.id === id ? <input className="tab-rename-input" aria-label={t("Rename terminal")} value={renaming.name} maxLength={120} autoFocus
                  onFocus={event => event.currentTarget.select()}
                  onChange={event => setRenaming({ id, name: event.target.value })}
                  onBlur={() => finishRename(true)}
                  onKeyDown={event => {
                    event.stopPropagation()
                    if (event.nativeEvent.isComposing) return
                    if (event.key === 'Enter' || event.key === 'Escape') {
                      event.preventDefault(); finishRename(event.key === 'Enter', true)
                    }
                  }} /> : <button role="tab" id={`tab-${id}`} aria-selected={group.active === id} aria-controls={`panel-${id}`} aria-label={s.name} title={s.name} tabIndex={group.active === id ? 0 : -1} aria-haspopup="menu" aria-expanded={tabMenu?.id === id} onClick={() => {
                  setTabMenu(null); dispatch({ type: 'select', group: index, id })
                }} onContextMenu={event => {
                  event.preventDefault()
                  endSlide(); dispatch({ type: 'select', group: index, id })
                  setTabMenu({ id, group: index, x: event.clientX, y: event.clientY })
                }} onDoubleClick={() => {
                  setTabMenu(null); endSlide(); dispatch({ type: 'select', group: index, id }); renameDone.current = false; setRenaming({ id, name: s.name })
                }}><span className={`status-dot ${s.status}`} aria-hidden="true" /><span className="session-tab-name">{s.name}</span>{s.status === 'running' && s.activity && <span className={`agent-tab-status agent-${s.activity}`}>{t(({ working: 'Working', waiting: 'Waiting for input', done: 'Done', error: 'Agent error', disconnected: 'Status unavailable' })[s.activity])}</span>}{unread.includes(id) && <span className="agent-unread" aria-label={t('Unread agent update')}>●</span>}</button>}
                <button className="close-tab" aria-label={t("Close {name}", { name: s.name })} title={t("Close {name}", { name: s.name })} disabled={closing.includes(id)} onClick={() => { if (s.status === 'running') setCloseTarget(s); else void close(id) }}>×</button>
              </div>
            })}
          </div>
          <Button size="xs" variant="ghost" flexShrink="0" aria-label={t("New session in group {number}", { number: index + 1 })} title={t("New session")} disabled={busy} onClick={() => requestSession(index)}>＋</Button>
          {split && <Button size="xs" variant="ghost" flexShrink="0" aria-label={t("Move active tab from group {number} to other group", { number: index + 1 })} title={t("Move active tab to other group")} disabled={busy} onClick={() => dispatch({ type: 'move', group: index })}>⇄</Button>}
        </div>)}
        {sessions.map(session => {
          const index = layout.groups.findIndex(g => g.ids.includes(session.id))
          const visible = index >= 0 && layout.groups[index].active === session.id
          return <div key={session.id} id={`panel-${session.id}`} role="tabpanel" aria-labelledby={`tab-${session.id}`} className="session-panel" style={{ ...position(Math.max(0, index), 2), display: visible ? 'flex' : 'none' }}>
            <TerminalPane session={session} visible={visible && page === 'workspace'} focused={visible && page === 'workspace' && layout.focused === index} autoFocusBlocked={tabMenu !== null || renaming !== null} onFocus={() => dispatch({ type: 'focus', group: index })} />
          </div>
        })}
        {separators.map(separator => <div key={separator.path} className={`group-separator separator-${separator.orientation}`} role="separator" tabIndex={0} aria-label={t("Resize terminal groups")} aria-orientation={separator.orientation === 'right' ? "vertical" : "horizontal"} aria-valuemin={25} aria-valuemax={75} aria-valuenow={separator.ratio} style={{ position: 'absolute', left: separator.orientation === 'right' ? `calc(${separator.left}% - 3px)` : `${separator.left}%`, top: separator.orientation === 'down' ? `calc(${separator.top}% - 3px)` : `${separator.top}%`, width: separator.orientation === 'right' ? 6 : `${separator.width}%`, height: separator.orientation === 'down' ? 6 : `${separator.height}%` }}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(separator, event.clientX, event.clientY) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          onDoubleClick={() => dispatch({ type: 'resize', path: separator.path, ratio: 50 })}
          onKeyDown={event => {
            const less = separator.orientation === 'right' ? 'ArrowLeft' : 'ArrowUp'
            const more = separator.orientation === 'right' ? 'ArrowRight' : 'ArrowDown'
            if (![less, more, 'Home', 'End'].includes(event.key)) return
            event.preventDefault(); dispatch({ type: 'resize', path: separator.path, ratio: event.key === 'Home' ? 25 : event.key === 'End' ? 75 : separator.ratio + (event.key === more ? 5 : -5) })
          }} />)}
        {!sessions.length && <div className="empty-state" style={position(0, 2)}><div><h2>{t("No open sessions")}</h2><p>{t("Create a Pi session to start working.")}</p><Button colorPalette="brand" size="sm" disabled={busy} onClick={() => requestSession(0)}>{t("New session")}</Button></div></div>}
      </div>
      <footer className="statusbar"><span>{sessions.filter(s => s.status === 'running').length} {t("processes running")}</span><span>{split ? t("{count} groups", { count: layout.groups.length }) : t("Single group")} {t("· Hidden sessions keep running")}</span></footer>
    </main>
    <div className="meeting-page-host" style={{ display: page === 'meeting' ? 'flex' : 'none' }}>
      <MeetingRoom sessions={sessions} active={page === 'meeting'} />
    </div>
    {page === 'settings' && <Settings />}
    {page === 'library' && <Library initialPlugin={setupPlugin} onPluginStatus={pluginStatus} />}
    {page === '9router' && routerInstalled && <RouterDashboard />}
    <WorkspaceSetup startupOnly active={page === 'workspace'} onContinue={async () => {}} onSetup={id => { setSetupPlugin(id); setPage('library') }} />
    <GitAskPassModal />
    {tabMenu && <Portal><div ref={tabMenuElement} className="terminal-tab-menu" role="menu" aria-labelledby={`tab-${tabMenu.id}`} style={{ left: tabMenu.x, top: tabMenu.y }} onKeyDown={event => {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const current = items.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault()
        const tab = document.getElementById(`tab-${tabMenu.id}`)
        if (event.key === 'Escape' || event.shiftKey) tab?.focus()
        else tab?.parentElement?.querySelector<HTMLButtonElement>('.close-tab')?.focus()
        setTabMenu(null)
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }
    }}>
      <button type="button" role="menuitem" onClick={() => {
        const session = sessions.find(s => s.id === tabMenu.id)
        setTabMenu(null)
        if (session) { renameDone.current = false; setRenaming({ id: session.id, name: session.name }) }
      }}>{t('Rename')}</button>
      <button type="button" role="menuitem" disabled={busy} onClick={() => { const group = tabMenu.group; setTabMenu(null); void add(group) }}>{t('Duplicate')}</button>
    </div></Portal>}
    <Dialog.Root role="alertdialog" open={closeTarget !== null} placement="center" size="sm" initialFocusEl={() => cancelClose.current} closeOnInteractOutside={false} onOpenChange={({ open }) => { if (!open && !closing.length) setCloseTarget(null) }}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>{t("Close {name}?", { name: closeTarget?.name || "" })}</Dialog.Title></Dialog.Header>
            <Dialog.Body><Dialog.Description>{t("This stops the Pi process and removes its tab. Any active work will be interrupted. Switch tabs instead to keep the session running.")}</Dialog.Description></Dialog.Body>
            <Dialog.Footer>
              <Button ref={cancelClose} variant="outline" disabled={closing.length > 0} onClick={() => setCloseTarget(null)}>{t("Cancel")}</Button>
              <Button colorPalette="red" loading={closing.length > 0} loadingText={t("Closing…")} disabled={closing.length > 0} onClick={() => { if (closeTarget) void close(closeTarget.id) }}>{t("Stop and close")}</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  </div>
}
