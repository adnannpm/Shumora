import { useLanguage } from './Language'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import { DataSkeleton } from './DataSkeleton'
export function RouterAuth({ onChange }: { onChange: () => void }) {
  const { t } = useLanguage()
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [open, setOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const passwordInput = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const formId = useId()
  const helperId = useId()
  const errorId = useId()
  const capsId = useId()
  function resetLogin() { setPassword(''); setShowPassword(false); setCapsLock(false); setError('') }
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
    if (submitting.current || !password) return
    submitting.current = true
    setBusy(true); setError(''); setShowPassword(false); setCapsLock(false)
    const value = password; setPassword('')
    try { await window.plugins.routerLogin(value); setAuthenticated(true); setOpen(false); onChange() }
    catch (e) {
      const message = e instanceof Error ? e.message : ''
      setError(message.includes('Incorrect dashboard password') ? 'Incorrect dashboard password. Check it before retrying to avoid lockout.' : message.includes('Too many login attempts') ? 'Too many login attempts. Wait before trying again.' : message.includes('Password login is unavailable') ? 'Password login is unavailable. SSO-only dashboard login is not supported here yet.' : 'Could not sign in. Check that 9router is running and the password is correct.')
    } finally {
      submitting.current = false
      setBusy(false)
      requestAnimationFrame(() => passwordInput.current?.focus())
    }
  }
  async function logout() {
    if (busy) return
    setBusy(true); setError('')
    try { await window.plugins.routerLogout(); setAuthenticated(false); setLogoutOpen(false); onChange() }
    catch { setError('Could not sign out. Check that 9router is running and try again.') }
    finally { setBusy(false) }
  }
  if (checking) return <DataSkeleton label={t("Loading dashboard session")} shape="button" />
  return <><Button size="sm" variant="outline" disabled={busy} onClick={() => { if (authenticated) { setError(''); setLogoutOpen(true) } else { resetLogin(); setOpen(true) } }}>{authenticated ? t("Sign out of 9router") : t("Sign in to 9router")}</Button>
    <Dialog.Root open={open} placement="center" initialFocusEl={() => passwordInput.current} onOpenChange={({ open }) => { if (!busy) { setOpen(open); resetLogin() } }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="router-signin-dialog" aria-busy={busy}>
        <Dialog.Header className="router-signin-header"><span className="router-signin-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg></span><div><Dialog.Title>{t('Sign in to 9router')}</Dialog.Title><Dialog.Description>{t('Connect Shumora to your local dashboard.')}</Dialog.Description></div></Dialog.Header>
        <Dialog.Body className="router-signin-body">
          <div className="router-signin-endpoint"><span>{t('Local dashboard')}</span><code>127.0.0.1:20128</code></div>
          <form id={formId} className="router-signin-form" onSubmit={e => { e.preventDefault(); void submit() }}>
            <label htmlFor={`${formId}-password`}>{t('Dashboard password')}</label>
            <div className="router-signin-password"><input ref={passwordInput} id={`${formId}-password`} required type={showPassword ? 'text' : 'password'} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={t('Enter dashboard password')} value={password} disabled={busy} aria-invalid={!!error} aria-describedby={`${helperId}${capsLock ? ` ${capsId}` : ''}${error ? ` ${errorId}` : ''}`} onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))} onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} onChange={e => { setPassword(e.target.value); setError('') }} /><Button type="button" variant="ghost" disabled={busy} aria-label={t(showPassword ? 'Hide password' : 'Show password')} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 3 18 18M10.5 5.2 12 5c6 0 10 7 10 7a19 19 0 0 1-4 4M6 6a20 20 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1" /><path d="M10 10a3 3 0 0 0 4 4" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>}</Button></div>
            <p id={helperId} className="router-signin-helper">{t('Use your dashboard password, not a provider API key.')}</p>
            {capsLock && <p id={capsId} className="router-signin-caps" role="status">{t('Caps Lock is on')}</p>}
            {error && <p id={errorId} className="router-signin-error" role="alert">{t(error)}</p>}
          </form>
          <p className="router-signin-privacy">{t('Your password is not saved. This session ends when Shumora closes or you sign out.')}</p>
        </Dialog.Body>
        <Dialog.Footer className="router-signin-footer"><Button variant="outline" disabled={busy} onClick={() => { setOpen(false); resetLogin() }}>{t('Cancel')}</Button><Button type="submit" form={formId} colorPalette="brand" loading={busy} loadingText={t('Signing in…')} disabled={busy || !password}>{t('Sign in')}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
    <Dialog.Root open={logoutOpen} role="alertdialog" placement="center" initialFocusEl={() => document.getElementById('router-logout-cancel')} onOpenChange={({ open }) => { if (!busy) { setLogoutOpen(open); setError('') } }}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content><Dialog.Header><Dialog.Title>{t('Sign out of 9router?')}</Dialog.Title></Dialog.Header><Dialog.Body><Dialog.Description>{t('This signs you out of the 9router dashboard in Shumora. It does not stop 9router or remove your provider accounts.')}</Dialog.Description>{error && <p className="plugin-error" role="alert">{t(error)}</p>}</Dialog.Body><Dialog.Footer><Button id="router-logout-cancel" variant="outline" disabled={busy} onClick={() => { setLogoutOpen(false); setError('') }}>{t('Cancel')}</Button><Button colorPalette="red" loading={busy} disabled={busy} onClick={() => void logout()}>{t('Sign out')}</Button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
  </>
}
