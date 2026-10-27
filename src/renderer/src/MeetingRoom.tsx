import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { useLanguage } from './Language'
import type { Session } from '../../shared/types'
import type { MeetingSnapshot } from '../../shared/meetings'

export function MeetingRoom({ sessions }: { sessions: Session[]; active?: boolean }) {
  const { t, language } = useLanguage()
  const [snapshot, setSnapshot] = useState<MeetingSnapshot>()
  const [agenda, setAgenda] = useState('')
  const [invited, setInvited] = useState<string[]>([])
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [leader, setLeader] = useState('user')
  const [direction, setDirection] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newMeeting, setNewMeeting] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const conversation = useRef<HTMLDivElement>(null)
  const previousMessageCount = useRef(0)
  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    const api = window.meetings
    if (!api) return
    let alive = true, changed = false
    const off = api.onChange(value => { changed = true; if (alive) setSnapshot(value) })
    void api.snapshot().then(value => { if (alive && !changed) setSnapshot(value) }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false; off() }
  }, [])
  const state = snapshot?.state
  const setup = !state || state.phase === 'setup' || newMeeting
  const participants = sessions.filter(s => invited.includes(s.id))
  const messageCount = state?.messages.length || 0
  useEffect(() => {
    const added = messageCount - previousMessageCount.current
    previousMessageCount.current = messageCount
    const log = conversation.current
    if (setup || added < 0) { setUnreadCount(0); return }
    if (log && added > 0 && log.scrollHeight - log.clientHeight - log.scrollTop > 24) {
      setUnreadCount(count => count + added)
    }
  }, [messageCount, setup])
  function markVisibleMessagesRead() {
    const log = conversation.current
    if (log && log.scrollHeight - log.clientHeight - log.scrollTop <= 24) setUnreadCount(0)
  }
  function jumpToLatest() {
    const log = conversation.current
    if (!log) return
    log.scrollTop = log.scrollHeight
    setUnreadCount(0)
  }
  async function action(work: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const speaker = state?.participants.find(p => p.id === state.speaker)
  const isSpeaking = (id: string) => state?.phase === 'running' && !state.awaitingUser && state.speaker === id
  return <main className="meeting-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t('Council')}</h1></header>
    {!window.meetings ? <div className="meeting-setup"><p>{t('Restart Shumora to enable Council.')}</p></div> : <div className={`meeting-auto-body ${!setup ? 'council-chat-body' : ''}`}>
      {(error || state?.error) && <p className="meeting-alert" role="alert">{t(error || state?.error || '')}</p>}
      {setup ? <section className="meeting-setup" aria-label={t('Prepare your team')}>
        <div className="council-topic">
          <h2>{t('New discussion')}</h2>
          <p>{t('Choose a topic and at least two agents to begin.')}</p>
          <label className="council-agenda">{t('Discussion topic')}<textarea aria-label={t('Discussion topic')} value={agenda} maxLength={4000} onChange={e => setAgenda(e.target.value)} placeholder={t('Example: Plan our product launch. Compare design, engineering and marketing priorities.')} /></label>
          <div className="council-launch">
            <label>{t('Moderator')}<select aria-label={t('Moderator')} value={leader} onChange={e => setLeader(e.target.value)}><option value="user">{t('You')}</option>{participants.map(s => <option value={s.id} key={s.id}>{s.name} {t('· AI moderator')}</option>)}</select></label>
            <button className="meeting-primary" disabled={busy || !snapshot || !agenda.trim() || participants.length < 2 || participants.some(p => snapshot.agents[p.id] !== 'ready')} onClick={() => void action(async () => { await window.meetings!.start({ agenda, participants: participants.map(s => ({ id: s.id, name: s.name, role: roles[s.id]?.trim() || '' })), leader, language }); setNewMeeting(false) })}>{t(busy ? 'Starting Council…' : 'Start Council')}</button>
          </div>
          <p className="council-launch-hint">{t('{count} members selected · at least 2 required', { count: participants.length })}</p>
          <p className="meeting-notice">{t('Two rounds, with your turn after each round, then a summary. The team waits for your input or permission to continue. Uses each participant’s model and credits. Tools are blocked; no tasks are executed.')}</p>
        </div>
        <aside className="council-members-panel" aria-label={t('Council members')}>
        <div className="council-panel-heading"><h3>{t('Council members')}</h3><small>{participants.length}/8</small></div>
        <p>{t('New Pi terminals connect automatically. Existing unconnected terminals are not restarted; open new terminals to use this feature.')}</p>
        {!sessions.length && <p>{t('Open at least two Pi terminals from the Terminals page first.')}</p>}
        <div className="meeting-invites">{sessions.map(session => {
          const status = snapshot?.agents[session.id] || 'disconnected'
          const ready = status === 'ready' && session.status === 'running'
          return <div className={`meeting-invite ${invited.includes(session.id) ? 'selected' : ''}`} key={session.id}>
            <label><input type="checkbox" aria-label={t('Invite {name}', { name: session.name })} checked={invited.includes(session.id)} disabled={!ready || busy || (!invited.includes(session.id) && invited.length >= 8)} onChange={e => { setInvited(ids => e.target.checked ? [...ids, session.id] : ids.filter(id => id !== session.id)); if (leader === session.id) setLeader('user') }} /><span className="council-member-info"><strong>{session.name}</strong><small className={ready ? 'council-ready' : ''}>{t(ready ? 'Ready for Council' : status === 'busy' ? 'Working — wait until idle' : 'Not connected')}</small></span></label>
            {invited.includes(session.id) && <input aria-label={t('Division for {name}', { name: session.name })} value={roles[session.id] || ''} maxLength={80} placeholder={t('Division, e.g. Design')} onChange={e => setRoles({ ...roles, [session.id]: e.target.value })} />}
          </div>
        })}</div>
        </aside>
      </section> : <section className="meeting-room-live" aria-label={t('Council discussion')}>
        <div className="meeting-live-header"><h2>{state.agenda}</h2>
          <div className="council-session-heading"><button type="button" aria-expanded={membersOpen} aria-controls="council-chat-members" onClick={() => setMembersOpen(open => !open)}>{t('{count} members', { count: state.participants.length })}</button><span className="council-round">{t(state.phase === 'completed' ? 'Completed' : state.phase === 'stopped' ? 'Stopped' : state.round === 3 ? 'Summary' : 'Round {round} of 2', { round: state.round })}</span></div>
          {membersOpen && <div id="council-chat-members" className="council-chat-members" role="group" aria-label={t('Council members')}>
            {state.participants.map(p => <div key={p.id} className="council-member-info"><strong>{p.name}</strong><small>{p.role || t('Member')}{isSpeaking(p.id) ? ` · ${t('Speaking')}` : ''}</small></div>)}
            <p className="council-chat-help">{state.leader === 'user' ? t('Led by you') : t('AI moderator: {name}', { name: state.participants.find(p => p.id === state.leader)?.name || '' })}<br />{t('Pause waits for the current response. Stop cancels the current Council turn. Leaving this page does not interrupt Council.')}</p>
          </div>}
          <div className="meeting-actions">{['running', 'paused'].includes(state.phase) && <>
          {state.leader !== 'user' && <button disabled={busy} onClick={() => void action(() => window.meetings!.takeOver())}>{t('Take over')}</button>}
          <button disabled={busy} onClick={() => void action(() => state.phase === 'paused' ? window.meetings!.resume() : window.meetings!.pause())}>{t(state.phase === 'paused' ? 'Resume Council' : 'Pause Council')}</button>
          <button disabled={busy} onClick={() => void action(() => window.meetings!.stop())}>{t('Stop Council')}</button>
        </>}{['completed', 'stopped'].includes(state.phase) && <button onClick={() => setNewMeeting(true)}>{t('New Council')}</button>}</div></div>
        <div className="council-transcript">
        <div ref={conversation} onScroll={markVisibleMessagesRead} className="meeting-conversation" role="log" aria-label={t('Discussion board')}>
          {!state.messages.length && <p>{t('Your team is preparing its first response…')}</p>}
          {state.messages.map((message, index) => {
            const previous = state.messages[index - 1]
            const grouped = message.kind !== 'summary' && previous?.kind === message.kind && previous.author === message.author
            return <article key={index} aria-label={message.author} className={`meeting-message meeting-${message.kind}${grouped ? ' is-grouped' : ''}`}>
            {!grouped && <div className="council-message-author"><strong>{message.author}</strong></div>}{message.kind === 'summary' && <h3>{t('Council summary')}</h3>}<div className="meeting-markdown"><Markdown skipHtml components={{
            a: ({ children, href }) => href && /^https?:\/\//i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
            img: ({ alt }) => <span>{alt}</span>
          }}>{message.text}</Markdown></div></article>
          })}
          <div className="meeting-progress" role="status">{state.phase === 'completed' ? t('Council complete. Review the summary before approving any work.') : state.phase === 'stopped' ? t('Council stopped. No further messages will be sent.') : state.awaitingUser ? t('The team is waiting for your input before continuing.') : state.phase === 'paused' ? t(state.speaker ? 'Pausing after the current speaker finishes…' : 'Council paused. Resume when ready.') : state.round === 3 ? t('Preparing the final summary…') : speaker ? t('{name} is typing…', { name: speaker.name }) : t('Your team is preparing its first response…')}</div>
        </div>
        {unreadCount > 0 && <button type="button" className="council-new-messages" onClick={jumpToLatest}>{t('{count} new messages ↓', { count: unreadCount })}</button>}
        </div>
        {['running', 'paused'].includes(state.phase) && <form className={`meeting-direction ${state.awaitingUser ? 'meeting-user-turn' : ''}`} onSubmit={e => { e.preventDefault(); void action(async () => { await window.meetings!.direction(direction); setDirection('') }) }}>{state.awaitingUser && <h2>{t('Your turn')}</h2>}<label><span className="council-composer-label">{t(state.awaitingUser ? 'Your message' : 'Join the discussion')}</span><textarea aria-label={t(state.awaitingUser ? 'Your message' : 'Your direction')} value={direction} maxLength={2000} onChange={e => setDirection(e.target.value)} placeholder={t('Add a question or priority. The next speaker will receive it automatically.')} /></label><div className="council-composer-actions">{state.awaitingUser && <button type="button" className="council-composer-skip" disabled={busy} onClick={() => void action(() => window.meetings!.resume())}>{t('Continue without a message')}</button>}<button type="submit" className="meeting-primary" disabled={busy || !direction.trim()}>{t(state.awaitingUser ? 'Send & continue' : 'Send message')}</button></div></form>}
      </section>}
    </div>}
  </main>
}
