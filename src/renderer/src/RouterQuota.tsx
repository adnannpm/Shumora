import { useEffect, useRef, useState } from 'react'
import { Button } from '@chakra-ui/react'
import type { RouterAccountQuota, RouterConnection } from '../../shared/plugins'
import { useLanguage } from './Language'
import { DataSkeleton } from './DataSkeleton'

type Account = { connection: RouterConnection; quota?: RouterAccountQuota; error?: string; checking?: boolean }
function remainingPercent(q: RouterAccountQuota['quotas'][number]) {
  if (q.unlimited) return undefined
  if (q.remainingPercentage !== undefined) return q.remainingPercentage
  if (q.total !== undefined && q.total > 0) {
    const remaining = q.remaining ?? (q.used !== undefined ? Math.max(0, q.total - q.used) : undefined)
    if (remaining !== undefined) return Math.min(100, Math.max(0, remaining / q.total * 100))
  }
  return undefined
}
function lowQuota(account: Account) {
  return account.connection.active && !!account.quota?.quotas.some(q => {
    const percent = remainingPercent(q)
    return percent !== undefined && percent <= 20
  })
}
export function RouterQuota() {
  const { t, language } = useLanguage()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState<string[]>([])
  const [now, setNow] = useState(Date.now())
  const generation = useRef(0)
  const loading = useRef(false)
  const locale = language === 'zh' ? 'zh-CN' : language
  const format = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 })
  async function load() {
    if (loading.current) return
    loading.current = true
    const request = ++generation.current
    setBusy(true); setError('')
    try {
      const connections = await window.plugins.routerProviders()
      if (request !== generation.current) return
      setAccounts(previous => connections.map(connection => ({ connection, quota: previous.find(a => a.connection.id === connection.id)?.quota, checking: true })))
      // Limit concurrency to avoid hammering provider quota endpoints.
      let next = 0
      await Promise.all(Array.from({ length: Math.min(3, connections.length) }, async () => {
        while (next < connections.length && request === generation.current) {
          const connection = connections[next++]
          let quota: RouterAccountQuota | undefined, failed = false
          try { quota = await window.plugins.routerQuota(connection.id) } catch { failed = true }
          if (request === generation.current) setAccounts(previous => previous.map(a => a.connection.id === connection.id ? { ...a, quota: quota || a.quota, checking: false, error: failed ? 'Could not refresh quota. Check 9router login and provider connection.' : undefined } : a))
        }
      }))
    } catch { if (request === generation.current) setError('Could not load accounts. Start 9router and sign in to its dashboard.') }
    finally { if (request === generation.current) { loading.current = false; setBusy(false) } }
  }
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => { generation.current++; loading.current = false; window.clearInterval(timer) }
  }, [])
  function resetLabel(value?: string) {
    if (!value || !Number.isFinite(Date.parse(value))) return t('Reset time not provided')
    const minutes = Math.ceil((Date.parse(value) - now) / 60000)
    return minutes <= 0 ? t('Reset time reached — refresh to check') : t('Resets in {hours}h {minutes}m', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
  }
  const visible = accounts.filter(account => {
    const { connection, quota } = account
    return `${connection.name} ${connection.provider} ${quota?.plan || ''}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (filter === 'all' || filter === 'low' && lowQuota(account) || filter === 'failed' && !!account.error || filter === 'disabled' && !connection.active)
  })
  function clearFilters() { setQuery(''); setFilter('all') }
  return <section className="router-quota">
    <div className="router-catalog-heading quota-heading"><div><span className="quota-eyebrow">{t('ACCOUNT MONITOR')}</span><h2>{t('Quota & Usage')}</h2><p>{t('Account limits reported by your providers through 9router.')}</p></div><Button variant="outline" loading={busy} disabled={busy} onClick={() => void load()}>{t('Refresh')}</Button></div>
    {busy ? <DataSkeleton label={t('Account summary')} shape="quota-summary" /> : <section className="quota-summary" aria-label={t('Account summary')}>
      {[{ label: 'Connected accounts', count: accounts.length, tone: '' }, { label: 'Low quota', count: accounts.filter(lowQuota).length, tone: 'warning' }, { label: 'Refresh failed', count: accounts.filter(a => a.error).length, tone: 'danger' }].map(item => <div key={item.label} className={`quota-summary-item ${item.tone}`} aria-label={t(item.label)}><span>{t(item.label)}</span><strong>{busy && !accounts.length ? '—' : item.count}</strong><small>{t(item.label === 'Low quota' ? 'Active accounts with 20% or less remaining' : item.label === 'Refresh failed' ? 'Accounts that could not be updated' : 'Provider connections in 9router')}</small></div>)}
    </section>}
    {error && <div role="alert" className="quota-notice quota-danger">{t(error)}{accounts.length > 0 && ` ${t('Showing last available data.')}`}</div>}
    {busy && <DataSkeleton label={t('Loading account quotas…')} shape="quota" />}
    {!busy && <>
    {accounts.length > 0 && <div className="quota-filters"><input type="search" aria-label={t('Search accounts')} placeholder={t('Search account, provider or plan…')} value={query} onChange={event => setQuery(event.target.value)} /><select aria-label={t('Filter accounts')} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t('All accounts')}</option><option value="low">{t('Low quota')}</option><option value="failed">{t('Refresh failed')}</option><option value="disabled">{t('Disabled')}</option></select><span role="status">{t('{shown} of {total} accounts', { shown: visible.length, total: accounts.length })}</span></div>}
    {!busy && !error && !accounts.length && <div className="quota-empty"><h3>{t('No connected accounts')}</h3><p>{t('No connected accounts. Add a provider in the Providers tab first.')}</p></div>}
    {accounts.length > 0 && !visible.length && <div className="quota-empty"><h3>{t('No matching accounts.')}</h3><p>{t('Try another search or change the status filter.')}</p><Button variant="outline" onClick={clearFilters}>{t('Clear filters')}</Button></div>}
    <div className="quota-account-grid">{visible.map(account => {
      const { connection, quota, error: accountError, checking } = account
      const status = checking ? 'Checking…' : accountError ? 'Refresh failed' : !connection.active ? 'Disabled' : lowQuota(account) ? 'Low quota' : quota?.quotas.length ? 'Available' : 'Not reported'
      const tone = accountError ? 'danger' : !connection.active || checking ? 'neutral' : lowQuota(account) ? 'warning' : quota?.quotas.length ? 'healthy' : 'neutral'
      return <section className={`router-quota-account ${!connection.active ? 'quota-disabled' : ''}`} key={connection.id} aria-label={connection.name} aria-busy={checking}>
        <header><span className="quota-avatar" aria-hidden="true">{connection.provider.slice(0, 2).toUpperCase()}</span><div className="quota-account-title"><h3>{connection.name}</h3><p>{connection.provider}{quota?.plan ? ` · ${quota.plan}` : ''}</p></div>{checking ? <DataSkeleton label={t('Checking…')} shape="button" /> : <span className={`quota-badge quota-${tone}`}>{t(status)}</span>}</header>
        {accountError && <p role="alert" className="quota-notice quota-danger">{t(accountError)}{quota ? ` ${t('Showing last available data.')}` : ''}</p>}
        {checking && <DataSkeleton label={t('Loading account quotas…')} rows={3} />}
        {!checking && quota && !quota.quotas.length && <div className="quota-unreported"><span aria-hidden="true">—</span><p>{t('Quota or credit balance is not provided for this account. Check the provider dashboard.')}</p></div>}
        {!checking && quota && quota.quotas.length > 0 && <div className={`quota-model-list ${expanded.includes(connection.id) ? 'is-expanded' : ''}`} tabIndex={expanded.includes(connection.id) && quota.quotas.length > 3 ? 0 : undefined} role="group" aria-label={t('Model quotas')}>
        {(expanded.includes(connection.id) ? quota.quotas : quota.quotas.slice(0, 3)).map(q => {
          const percent = remainingPercent(q)
          const tone = percent === undefined ? 'neutral' : percent <= 20 ? 'danger' : percent <= 50 ? 'warning' : 'healthy'
          return <div className={`router-quota-window quota-${tone}`} key={q.name}>
            <div className="router-quota-window-heading"><strong>{q.name}</strong><span>{t('Remaining quota')}</span></div>
            <div className="quota-value">{q.unlimited ? t('Unlimited') : q.remainingPercentage !== undefined ? t('{percent}% remaining', { percent: format(q.remainingPercentage) }) : q.remaining !== undefined ? t('{amount} remaining', { amount: format(q.remaining) }) : <span className="quota-value-unknown">{t('Remaining quota not provided')}</span>}</div>
            {percent !== undefined && <meter min={0} max={100} value={percent} aria-label={`${q.name} ${t('Remaining quota')}`} />}
            {!q.unlimited && percent === undefined && q.remaining !== undefined && <div className="quota-credit-unscaled"><div className="quota-credit-track" role="img" aria-label={t('{name}: total credit limit not provided', { name: q.name })} /><small>{t('Total credit limit not provided')}</small></div>}
            <div className="router-quota-window-meta"><span>{q.used !== undefined ? `${t('Used')}: ${format(q.used)}` : ''}{q.total !== undefined ? ` / ${format(q.total)}` : ''}</span>{!q.unlimited && <span>{resetLabel(q.resetAt)}</span>}</div>
            {!q.unlimited && q.resetAt && Number.isFinite(Date.parse(q.resetAt)) && <small>{t('Reset')}: {new Date(q.resetAt).toLocaleString(locale)}</small>}
          </div>
        })}</div>}
        {!checking && quota && quota.quotas.length > 3 && <div className="quota-model-toggle"><span>{t('{shown} of {total} models', { shown: expanded.includes(connection.id) ? quota.quotas.length : 3, total: quota.quotas.length })}</span><Button size="sm" variant="ghost" aria-expanded={expanded.includes(connection.id)} onClick={() => setExpanded(previous => previous.includes(connection.id) ? previous.filter(id => id !== connection.id) : [...previous, connection.id])}>{expanded.includes(connection.id) ? t('Show fewer') : t('Show all {count} models', { count: quota.quotas.length })}</Button></div>}
        {!checking && quota && <footer className="quota-account-footer"><span>{!connection.active ? t('Disabled') : t('Provider-reported data')}</span><span>{t('Last checked')}: {new Date(quota.checkedAt).toLocaleTimeString(locale)}</span></footer>}
      </section>
    })}</div>
    </>}
    <footer className="quota-page-footer"><p>{t('Quota is not a token wallet. Credits, tokens and reset windows depend on your provider; unavailable balances are not estimated.')}</p><a href="http://127.0.0.1:20128/dashboard/quota" target="_blank" rel="noopener noreferrer">{t('Open 9router quota dashboard')} ↗</a></footer>
  </section>
}
