import { useEffect, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import { DataSkeleton } from './DataSkeleton'
export function RouterAuth({ onChange }: { onChange: () => void }) {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function check() {
      try { const state = await window.plugins.routerAuthStatus(); if (active) setAuthenticated(state.authenticated) } catch { if (active) setAuthenticated(false) } finally { if (active) setChecking(false) }
    }
    void check()
    const timer = setInterval(() => void check(), 15000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  async function submit() {
    setBusy(true); setError('')
    const value = password; setPassword('')
    try { await window.plugins.routerLogin(value); setAuthenticated(true); setOpen(false); onChange() }
    catch (e) {
      const message = e instanceof Error ? e.message : ''
      setError(message.includes('Incorrect dashboard password') ? 'Incorrect dashboard password. Check it before retrying to avoid lockout.' : message.includes('Too many login attempts') ? 'Too many login attempts. Wait before trying again.' : message.includes('Password login is unavailable') ? 'Password login is unavailable. SSO-only dashboard login is not supported here yet.' : 'Could not sign in. Check that 9router is running and the password is correct.')
    } finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true)
    try { await window.plugins.routerLogout(); setAuthenticated(false); onChange() } finally { setBusy(false) }
  }
  if (checking) return <DataSkeleton label="Loading dashboard session" shape="button" />
  return <><Button size="sm" variant="outline" disabled={busy} onClick={() => { if (authenticated) void logout(); else { setError(''); setOpen(true) } }}>{authenticated ? 'Sign out of 9router' : 'Sign in to 9router'}</Button>
    <Dialog.Root open={open} placement="center" onOpenChange={({ open }) => { if (!busy) { setOpen(open); setPassword('') } }}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>Sign in to 9router</Dialog.Title></Dialog.Header><Dialog.Body><p>Enter your local 9router dashboard password, not a provider API key. The password is not saved. The session is kept only until Shumora closes or you sign out.</p><form id="router-login" className="router-provider-form" onSubmit={e => { e.preventDefault(); void submit() }}><label>Dashboard password<input required type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="plugin-error" role="alert">{error}</p>}</form></Dialog.Body><Dialog.Footer><Button variant="outline" disabled={busy} onClick={() => { setOpen(false); setPassword('') }}>Cancel</Button><Button type="submit" form="router-login" variant="outline" disabled={busy || !password}>Sign in</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </>
}
