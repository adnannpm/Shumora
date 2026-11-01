import { useEffect, useState } from 'react'
import type { TerminalAgent, TerminalAgentState } from '../../shared/terminal-agent'
import { useLanguage } from './Language'

export function TerminalAgentControl() {
  const { t } = useLanguage()
  const [state, setState] = useState<TerminalAgentState>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      if (!window.terminalAgent) throw new Error('Terminal agent API is unavailable')
      setState(await window.terminalAgent.status())
    } catch {
      setError('Could not load terminal agent settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function select(agent: TerminalAgent) {
    if (!window.terminalAgent || busy) return
    setBusy(true)
    setError('')
    try {
      setState(await window.terminalAgent.select(agent))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const active = state?.active ?? 'pi'
  const canChange = state?.canChange ?? false
  const piInstalled = state?.installed.pi ?? false
  const opencodeInstalled = state?.installed.opencode ?? false

  return (
    <section className="settings-section" aria-busy={loading || busy}>
      <div className="settings-row">
        <div>
          <h3 id="terminal-agent-label">{t('Terminal agent')}</h3>
          <p>{t('Choose which AI coding agent powers your terminal sessions.')}</p>
        </div>
        <select
          id="terminal-agent-select"
          aria-labelledby="terminal-agent-label"
          aria-label={t('Terminal agent')}
          value={loading ? '' : active}
          disabled={!canChange || busy || !state}
          onChange={(event) => void select(event.target.value as TerminalAgent)}
        >
          {loading && <option value="">{t('Loading terminal agents…')}</option>}
          <option value="pi" disabled={!piInstalled}>
            {!state || piInstalled ? 'Pi' : t('Pi (not installed)')}
          </option>
          <option value="opencode" disabled={!opencodeInstalled}>
            {!state || opencodeInstalled ? 'OpenCode' : t('OpenCode (not installed)')}
          </option>
        </select>
      </div>

      {(loading || busy) && (
        <p className="settings-note" role="status">
          {t(loading ? 'Loading terminal agents…' : 'Saving terminal agent…')}
        </p>
      )}

      {!busy && !canChange && state && (
        <p className="settings-note" role="status">
          {t('Close all terminal tabs to switch the agent.')}
        </p>
      )}

      {!busy && canChange && state && (
        <p className="settings-note" role="status">
          {active === 'opencode'
            ? t('OpenCode is active for new terminal sessions.')
            : t('Pi is active for new terminal sessions.')}
        </p>
      )}

      {state && (!piInstalled || !opencodeInstalled) && (
        <p className="settings-note">
          {t('Install missing agents from Library → Plugins.')}
        </p>
      )}

      {error && <p role="alert" className="plugin-error">{t(error)}</p>}
    </section>
  )
}
