import { useEffect, useState } from 'react'
import { Button } from '@chakra-ui/react'
import { useLanguage } from './Language'
import { managerPluginInfo } from './manager-plugin-info'
import type { ManagerPluginId, NodeInstallation } from '../../shared/plugins'
import nodeThumbnail from './assets/nodejs-thumbnail.svg?no-inline'
import opencodeThumbnail from './assets/opencode-thumbnail.svg?no-inline'
import { PluginDetailHeader } from './PluginDetailHeader'
import { DataSkeleton } from './DataSkeleton'

export function RuntimeCard({ kind, onOpen }: { kind: 'node' | 'opencode' | ManagerPluginId; onOpen: () => void }) {
  const { t } = useLanguage()
  const [installation, setInstallation] = useState<NodeInstallation>()
  const [checking, setChecking] = useState(true)
  const manager = kind !== 'node' && kind !== 'opencode' ? managerPluginInfo[kind] : undefined
  const name = manager?.name || (kind === 'node' ? 'Node.js' : 'OpenCode')
  useEffect(() => {
    let active = true
    const api = kind === 'node' ? window.nodePlugin : kind === 'opencode' ? window.opencodePlugin : window.managerPlugins ? { status: () => window.managerPlugins.status(kind) } : undefined
    void api?.status().then(value => { if (active) setInstallation(value) }).catch(() => {}).finally(() => { if (active) setChecking(false) })
    if (!api) setChecking(false)
    return () => { active = false }
  }, [kind])
  return <button className="plugin-card" aria-label={`Open ${name} plugin`} onClick={onOpen}>
    <img src={manager?.thumbnail || (kind === 'node' ? nodeThumbnail : opencodeThumbnail)} alt={`${name} thumbnail`} />
    <span className="plugin-card-content"><strong>{name}</strong><span>{manager ? t(manager.description) : kind === 'node' ? t('JavaScript runtime used by Pi, 9router and other coding tools.') : t('An open source AI coding agent for the terminal.')}</span><small>{checking ? t('Checking…') : !installation ? t('Installation status unavailable') : installation.installed ? t('Installed · {version}', { version: installation.installedVersion || '' }) : t('Not installed')}</small></span>
  </button>
}

export function NodeDetails({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage()
  const [installation, setInstallation] = useState<NodeInstallation>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function refresh() {
    setBusy(true); setError('')
    try {
      if (!window.nodePlugin) throw new Error('Restart Shumora to load the plugin bridge.')
      setInstallation(await window.nodePlugin.status())
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void refresh() }, [])
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <PluginDetailHeader name="Node.js" onBack={onBack} busy={busy} onRefresh={() => void refresh()} />
    <div className="router-details"><div className="plugin-detail-media"><img src={nodeThumbnail} alt="Node.js thumbnail" /></div><h2>Node.js</h2><p>{t('JavaScript runtime used by Pi, 9router and other coding tools.')}</p>
      <p className="plugin-attribution package-sources"><a href="https://github.com/nodejs/node" target="_blank" rel="noopener noreferrer">{t('Repository')}</a><a href="https://nodejs.org/en" target="_blank" rel="noopener noreferrer">Node.js</a><span>{t('MIT ·')} Node.js contributors</span></p>
      {!installation && !error ? <DataSkeleton label={t('Loading plugin details')} shape="details" rows={3} /> : <dl className="settings-details"><div><dt>{t('Installation')}</dt><dd>{!installation ? t('Checking…') : error ? t('Unverified') : installation.installed ? t('Installed') : t('Not installed')}</dd></div><div><dt>{t('Installed version')}</dt><dd>{installation?.installedVersion || '—'}</dd></div><div><dt>{t('Executable')}</dt><dd>{installation?.executable || '—'}</dd></div></dl>}
      {error && <p role="alert" className="plugin-error">{error}</p>}
      <p className="settings-note">{t('Node.js is detected from PATH, not the Electron runtime. Install and update it using the official installer or your existing version manager (nvm/fnm). Shumora never uninstalls Node.js because other tools depend on it. Restart Shumora after changing PATH.')}</p>
    </div>
    <footer className="plugin-detail-footer" aria-label={t('Plugin actions')}>
      <span className="plugin-action-status" role="status">{busy ? t('Checking or applying plugin changes…') : error ? t('Installation status unavailable') : installation?.installed ? t('Installed · {version}', { version: installation.installedVersion || t('Unknown version') }) : installation ? t('Not installed') : t('Loading plugin…')}</span>
      <div className="plugin-footer-buttons"><Button asChild className="library-primary-action" colorPalette="brand"><a href="https://nodejs.org/en/download" target="_blank" rel="noopener noreferrer">{t('Download Node.js')}</a></Button></div>
    </footer>
  </main>
}
