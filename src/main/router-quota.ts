import { routerFetch } from './router-auth'
import type { RouterAccountQuota } from '../shared/plugins'
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
export async function routerQuota(connectionId: string): Promise<RouterAccountQuota> {
  if (typeof connectionId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(connectionId)) throw new Error('Invalid connection ID')
  const response = await routerFetch(`usage/${encodeURIComponent(connectionId)}`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), cache: 'no-store' })
  if (response.status === 401 || response.status === 403) throw new Error('Sign in to 9router and check the provider connection.')
  if (!response.ok) throw new Error(`Could not load quota (HTTP ${response.status}).`)
  const data = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Unsupported quota response')
  if (data.error) throw new Error('9router could not fetch this account quota. Check the connection in the dashboard.')
  const quotas: RouterAccountQuota['quotas'] = []
  if (data.quotas && typeof data.quotas === 'object' && !Array.isArray(data.quotas)) {
    for (const [name, value] of Object.entries(data.quotas).slice(0, 100)) {
      if (!value || typeof value !== 'object') continue
      const q = value as Record<string, unknown>
      const used = number(q.used), total = number(q.total), remaining = number(q.remaining)
      const percent = number(q.remainingPercentage)
      const reset = typeof q.resetAt === 'string' ? Date.parse(q.resetAt) : NaN
      if (used === undefined && total === undefined && remaining === undefined && percent === undefined && q.unlimited !== true) continue
      quotas.push({ name: name.slice(0, 150), used, total, remaining, remainingPercentage: percent !== undefined && percent <= 100 ? percent : undefined, unlimited: q.unlimited === true, resetAt: Number.isFinite(reset) ? new Date(reset).toISOString() : undefined })
    }
  }
  // Whitelist fields: upstream responses can contain account metadata or credentials.
  return { checkedAt: new Date().toISOString(), plan: typeof data.plan === 'string' ? data.plan.slice(0, 150) : undefined, quotas }
}
