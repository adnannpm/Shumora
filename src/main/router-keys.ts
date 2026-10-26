import { routerFetch } from './router-auth'
import type { RouterKey } from '../shared/plugins'
async function request(method: 'GET' | 'POST', name?: string) {
  const response = await routerFetch('keys', {
    method, redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ name }) } : {})
  })
  if (response.status === 401 || response.status === 403) throw new Error('9router requires login. Sign in from the 9router header in Shumora.')
  if (!response.ok) throw new Error(`9router key API failed (HTTP ${response.status})`)
  return response.json()
}
function key(value: any): RouterKey {
  if (!value || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.key !== 'string') throw new Error('Unsupported 9router key response')
  return { id: value.id, name: value.name, key: value.key }
}
export async function routerKeys(): Promise<RouterKey[]> {
  const value = await request('GET')
  if (!Array.isArray(value.keys)) throw new Error('Unsupported 9router keys response')
  return value.keys.map(key)
}
export async function routerCreateKey(name: string): Promise<RouterKey> {
  if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error('Enter a key name (1–100 characters)')
  return key(await request('POST', name.trim()))
}
