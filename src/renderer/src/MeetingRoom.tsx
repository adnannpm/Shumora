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
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const api = window.meetings
    if (!api) return
    let alive = true, changed = false
    const off = api.onChange(value => { changed = true; if (alive) setSnapshot(value) })
    void api.snapshot().then(value => { if (alive && !changed) setSnapshot(value) }).catch(e => { if (alive) setError(String(e)) })
    return () => { alive = false; off() }
  }, [])
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [snapshot?.state.messages.length])
  const state = snapshot?.state
  const setup = !state || state.phase === 'setup' || newMeeting
  const participants = sessions.filter(s => invited.includes(s.id))
  async function action(work: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const speaker = state?.participants.find(p => p.id === state.speaker)
  return <main className="meeting-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t('Meeting Room')}</h1><span className="meeting-badge">{t('Automatic discussion')}</span></header>
    {!window.meetings ? <div className="meeting-setup"><p>{t('Restart Shumora to enable automatic meetings.')}</p></div> : <div className="meeting-auto-body">
      {(error || state?.error) && <p className="meeting-alert" role="alert">{t(error || state?.error || '')}</p>}
      {setup ? <section className="meeting-setup" aria-label={t('Prepare your team')}>
        <h2>{t('What should your team discuss?')}</h2>
        <p>{t('Choose your team, give them a topic, and let them exchange ideas automatically.')}</p>
        <label>{t('Meeting agenda')}<textarea aria-label={t('Meeting agenda')} value={agenda} maxLength={4000} onChange={e => setAgenda(e.target.value)} placeholder={t('Example: Plan our product launch. Compare design, engineering and marketing priorities.')} /></label>
        <h3>{t('Choose participants')} <small>{participants.length}/8</small></h3>
        <p>{t('New Pi terminals connect automatically. Existing unconnected terminals are not restarted; open new terminals to use this feature.')}</p>
        {!sessions.length && <p>{t('Open at least two Pi terminals from the Terminals page first.')}</p>}
        <div className="meeting-invites">{sessions.map(session => {
          const status = snapshot?.agents[session.id] || 'disconnected'
          const ready = status === 'ready' && session.status === 'running'
          return <div className={`meeting-invite ${invited.includes(session.id) ? 'selected' : ''}`} key={session.id}>
            <label><input type="checkbox" aria-label={t('Invite {name}', { name: session.name })} checked={invited.includes(session.id)} disabled={!ready || busy || (!invited.includes(session.id) && invited.length >= 8)} onChange={e => { setInvited(ids => e.target.checked ? [...ids, session.id] : ids.filter(id => id !== session.id)); if (leader === session.id) setLeader('user') }} /><strong>{session.name}</strong><small>{t(ready ? 'Ready for meeting' : status === 'busy' ? 'Working — wait until idle' : 'Not connected')}</small></label>
            {invited.includes(session.id) && <input aria-label={t('Division for {name}', { name: session.name })} value={roles[session.id] || ''} maxLength={80} placeholder={t('Division, e.g. Design')} onChange={e => setRoles({ ...roles, [session.id]: e.target.value })} />}
          </div>
        })}</div>
        <label>{t('Meeting leader')}<select aria-label={t('Meeting leader')} value={leader} onChange={e => setLeader(e.target.value)}><option value="user">{t('You')}</option>{participants.map(s => <option value={s.id} key={s.id}>{s.name} {t('· AI moderator')}</option>)}</select></label>
        <p className="meeting-notice">{t('Two rounds, with your turn after each round, then a summary. The team waits for your input or permission to continue. Uses each participant’s model and credits. Tools are blocked; no tasks are executed.')}</p>
        <button className="meeting-primary" disabled={busy || !snapshot || !agenda.trim() || participants.length < 2 || participants.some(p => snapshot.agents[p.id] !== 'ready')} onClick={() => void action(async () => { await window.meetings!.start({ agenda, participants: participants.map(s => ({ id: s.id, name: s.name, role: roles[s.id]?.trim() || '' })), leader, language }); setNewMeeting(false) })}>{t(busy ? 'Starting meeting…' : 'Start meeting')}</button>
      </section> : <section className="meeting-room-live" aria-label={t('Meeting discussion')}>
        <div className="meeting-live-header"><h2>{state.agenda}</h2><p>{state.participants.map(p => `${p.name}${p.role ? ` · ${p.role}` : ''}`).join(' / ')}</p><div className="meeting-actions"><span>{state.leader === 'user' ? t('Led by you') : t('AI moderator: {name}', { name: state.participants.find(p => p.id === state.leader)?.name || '' })}</span>{['running', 'paused'].includes(state.phase) && <>
          {state.leader !== 'user' && <button disabled={busy} onClick={() => void action(() => window.meetings!.takeOver())}>{t('Take over')}</button>}
          <button disabled={busy} onClick={() => void action(() => state.phase === 'paused' ? window.meetings!.resume() : window.meetings!.pause())}>{t(state.phase === 'paused' ? 'Resume meeting' : 'Pause meeting')}</button>
          <button disabled={busy} onClick={() => void action(() => window.meetings!.stop())}>{t('Stop meeting')}</button>
        </>}{['completed', 'stopped'].includes(state.phase) && <button onClick={() => setNewMeeting(true)}>{t('New meeting')}</button>}</div></div>
        <div className="meeting-conversation" role="log" aria-label={t('Discussion board')}>
          {!state.messages.length && <p>{t('Your team is preparing its first response…')}</p>}
          {state.messages.map((message, index) => <article key={index} className={`meeting-message meeting-${message.kind}`}><strong>{message.author}{message.kind === 'summary' ? ` · ${t('Meeting summary')}` : ''}</strong><div className="meeting-markdown"><Markdown skipHtml components={{
            a: ({ children, href }) => href && /^https?:\/\//i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
            img: ({ alt }) => <span>{alt}</span>
          }}>{message.text}</Markdown></div></article>)}
          <div className="meeting-progress" role="status">{state.phase === 'completed' ? t('Meeting complete. Review the summary before approving any work.') : state.phase === 'stopped' ? t('Meeting stopped. No further messages will be sent.') : state.awaitingUser ? t('The team is waiting for your input before continuing.') : state.phase === 'paused' ? t(state.speaker ? 'Pausing after the current speaker finishes…' : 'Meeting paused. Resume when ready.') : state.round === 3 ? t('Preparing the final summary…') : t('Round {round} of 2 · {name} is thinking…', { round: state.round, name: speaker?.name || '' })}</div><div ref={end} />
        </div>
        {['running', 'paused'].includes(state.phase) && <form className={`meeting-direction ${state.awaitingUser ? 'meeting-user-turn' : ''}`} onSubmit={e => { e.preventDefault(); void action(async () => { await window.meetings!.direction(direction); setDirection('') }) }}>{state.awaitingUser && <><h2>{t('Your turn')}</h2><p>{t('What do you think? Answer the team, ask a question, or continue without a message.')}</p></>}<label>{t(state.awaitingUser ? 'Your message' : 'Join the discussion')}<textarea aria-label={t(state.awaitingUser ? 'Your message' : 'Your direction')} value={direction} maxLength={2000} onChange={e => setDirection(e.target.value)} placeholder={t('Add a question or priority. The next speaker will receive it automatically.')} /></label><button disabled={busy || !direction.trim()}>{t(state.awaitingUser ? 'Send & continue' : 'Send message')}</button>{state.awaitingUser && <button type="button" disabled={busy} onClick={() => void action(() => window.meetings!.resume())}>{t('Continue without a message')}</button>}</form>}
        <p className="meeting-footnote">{t('Pause waits for the current response. Stop cancels the current meeting turn. Leaving this page does not interrupt the meeting.')}</p>
      </section>}
    </div>}
  </main>
}
