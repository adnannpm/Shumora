let cookie: string | undefined
// This module is main-process only. Never return the cookie or persist credentials.
export async function routerFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!/^[a-zA-Z0-9_/?=&.%+-]+$/.test(path) || path.startsWith('/') || path.includes('..') || path.includes('://')) throw new Error('Invalid local API path')
  const headers = new Headers(options.headers)
  if (cookie) headers.set('Cookie', cookie)
  const response = await fetch(`http://127.0.0.1:20128/api/${path}`, { ...options, headers, redirect: 'error', signal: options.signal || AbortSignal.timeout(15000), cache: 'no-store' })
  if (response.status === 401) cookie = undefined
  return response
}
export function routerLogout(): void { cookie = undefined }
export async function routerLogin(password: string): Promise<void> {
  if (typeof password !== 'string' || !password || password.length > 10000) throw new Error('Enter your 9router dashboard password')
  cookie = undefined
  const response = await routerFetch('auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
  if (response.status === 401) throw new Error('Incorrect dashboard password. Check your password before trying again to avoid account lockout.')
  if (response.status === 429) throw new Error('Too many login attempts. Wait before trying again.')
  if (response.status === 403) throw new Error('Password login is unavailable. Check your 9router authentication settings; SSO-only login is not supported in Shumora yet.')
  if (!response.ok) throw new Error('Could not sign in to the local 9router dashboard')
  const setCookie = response.headers.get('set-cookie') || ''
  const token = setCookie.match(/(?:^|,\s*)auth_token=([^;\s,]+)/)?.[1]
  if (!token) throw new Error('9router did not return a dashboard session')
  cookie = `auth_token=${token}`
}
export async function routerAuthStatus(): Promise<{ authenticated: boolean; required: boolean }> {
  const response = await routerFetch('auth/status', { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error('Cannot check 9router authentication')
  const data = await response.json() as { authenticated?: boolean; requireLogin?: boolean }
  if (!data.authenticated) cookie = undefined
  return { authenticated: data.authenticated === true, required: data.requireLogin !== false }
}
