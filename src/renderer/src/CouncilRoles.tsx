import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import { useLanguage } from './Language'

export interface CouncilRole { id: string; name: string }
const key = 'shumora.council-roles'
const changed = 'shumora:council-roles-changed'
export const defaultCouncilRoles: CouncilRole[] = ['Product', 'Design / UI/UX', 'Frontend', 'Backend', 'Engineering', 'QA / Testing', 'DevOps', 'Security', 'Research', 'Marketing'].map(name => ({ id: name.toLowerCase().replace(/[^a-z]+/g, '-'), name }))
export function readCouncilRoles(): CouncilRole[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return defaultCouncilRoles
    const value: unknown = JSON.parse(raw)
    if (Array.isArray(value) && value.length <= 100 && value.every(role => role && typeof role.id === 'string' && role.id && typeof role.name === 'string' && role.name.trim() && role.name.length <= 80) && new Set(value.map(role => role.id)).size === value.length) return value
  } catch { /* Use defaults if storage is unavailable or corrupt. */ }
  return defaultCouncilRoles
}
export function useCouncilRoles() {
  const [roles, setRoles] = useState(readCouncilRoles)
  useEffect(() => {
    const refresh = () => setRoles(readCouncilRoles())
    window.addEventListener(changed, refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener(changed, refresh); window.removeEventListener('storage', refresh) }
  }, [])
  function save(next: CouncilRole[]) {
    window.localStorage.setItem(key, JSON.stringify(next))
    setRoles(next)
    window.dispatchEvent(new Event(changed))
  }
  return { roles, save }
}
export function CouncilRolesSettings() {
  const { t } = useLanguage()
  const { roles, save } = useCouncilRoles()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  function commit(next: CouncilRole[]) {
    try { save(next); setError(''); return true } catch { setError('Could not save Council roles.'); return false }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 80) return
    if (roles.some(role => role.id !== editing && role.name.toLowerCase() === trimmed.toLowerCase())) { setError('A role with this name already exists.'); return }
    if (commit(editing ? roles.map(role => role.id === editing ? { ...role, name: trimmed } : role) : [...roles, { id: crypto.randomUUID(), name: trimmed }])) { setName(''); setEditing(null) }
  }
  return <section className="settings-section"><div className="settings-row"><div><h3>{t('Council roles')}</h3><p>{t('Manage the divisions available in Council member dropdowns. Changes apply to new discussions.')}</p></div><Button className="council-role-secondary" size="sm" variant="outline" onClick={() => setOpen(true)}>{t('Manage roles')}</Button></div>
    <Dialog.Root open={open} placement="center" size="md" initialFocusEl={() => input.current} onOpenChange={({ open: next }) => { setOpen(next); if (!next) { setEditing(null); setName(''); setDeleting(null); setError('') } }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="council-roles-dialog">
        <Dialog.Header className="council-role-header"><Dialog.Title>{t('Council roles')}</Dialog.Title><Dialog.Description>{t('Choose which divisions appear when inviting Council members.')}</Dialog.Description><button className="council-role-close" type="button" aria-label={t('Close role manager')} onClick={() => { setOpen(false); setEditing(null); setName(''); setDeleting(null); setError('') }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></Dialog.Header>
        <Dialog.Body className="council-role-body">
          <form className="council-role-form" onSubmit={submit}><label htmlFor="council-role-name">{t(editing ? 'Edit role' : 'Add role')}</label><div><input ref={input} id="council-role-name" aria-label={t('Role name')} name="council-role" autoComplete="off" placeholder={t('e.g. Technical writer…')} value={name} maxLength={80} onChange={event => setName(event.target.value)} /><Button className="council-role-primary" size="sm" type="submit" disabled={!name.trim() || (!editing && roles.length >= 100)}>{t(editing ? 'Save role' : 'Add role')}</Button>{editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setName(''); setError(''); input.current?.focus() }}>{t('Cancel')}</Button>}</div></form>
          {error && <p className="council-role-error" role="alert">{t(error)}</p>}
          <div className="council-role-list-heading"><span>{t('Available roles')}</span><span>{t('{count} roles', { count: roles.length })}</span></div>
          <ul className="council-role-list">{roles.map(role => <li key={role.id}><span className="council-role-name">{role.name}</span>{deleting === role.id ? <div className="council-role-confirm"><span>{t('Delete this role?')}</span><Button className="council-role-danger" size="xs" onClick={() => { if (commit(roles.filter(item => item.id !== role.id))) { setDeleting(null); if (editing === role.id) { setEditing(null); setName('') } } }}>{t('Delete')}</Button><Button size="xs" variant="ghost" onClick={() => setDeleting(null)}>{t('Cancel')}</Button></div> : <div className="council-role-actions"><button type="button" aria-label={t('Edit role {name}', { name: role.name })} title={t('Edit role {name}', { name: role.name })} onClick={() => { setEditing(role.id); setName(role.name); setDeleting(null); setError(''); input.current?.focus() }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" /></svg></button><button type="button" aria-label={t('Delete role {name}', { name: role.name })} title={t('Delete role {name}', { name: role.name })} onClick={() => { setDeleting(role.id); setError('') }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" /></svg></button></div>}</li>)}</ul>
          {!roles.length && <p className="council-role-empty">{t('No roles yet. Add your first division above.')}</p>}
        </Dialog.Body>
        <Dialog.Footer className="council-role-footer"><span>{t('Changes save automatically.')}</span><Button className="council-role-secondary" size="sm" variant="outline" onClick={() => { setOpen(false); setEditing(null); setName(''); setDeleting(null); setError('') }}>{t('Done')}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </section>
}
