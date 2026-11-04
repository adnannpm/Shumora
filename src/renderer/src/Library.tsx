import { useLanguage } from './Language'
import { useEffect, useState } from 'react'
import { Tabs } from '@chakra-ui/react'
import { Packages } from './Packages'
import { PackageDetails } from './PackageDetails'
import { LibraryUpdates } from './LibraryUpdates'
import { RouterCard, RouterDetails, PiCard } from './RouterPlugin'
import { RuntimeCard, NodeDetails } from './RuntimePlugins'
import { managerPluginInfo } from './manager-plugin-info'
import type { ManagerPluginId, RouterPlugin } from '../../shared/plugins'
import type { PackageQuery, PiPackage } from '../../shared/packages'

const pluginCatalog = [
  { id: '9router', name: '9router', category: 'gateway', description: 'A self-hosted AI gateway for coding tools, with provider routing, automatic fallback, and quota tracking.' },
  { id: 'pi', name: 'Pi', category: 'agent', description: 'An extensible terminal coding agent used by Shumora workspaces.' },
  { id: 'node', name: 'Node.js', category: 'runtime', description: 'JavaScript runtime used by Pi, 9router and other coding tools.' },
  { id: 'opencode', name: 'OpenCode', category: 'agent', description: 'An open source AI coding agent for the terminal.' },
  ...(['pnpm', 'bun', 'yarn'] as const).map(id => ({ id, ...managerPluginInfo[id], category: 'manager' }))
] as const
const pluginCategories = { '': 'All categories', agent: 'AI agents', gateway: 'Gateways', runtime: 'Runtimes', manager: 'Package managers' } as const

export function Library({ onPluginStatus, initialPlugin = null, initialPackage, initialType = '' }: { initialType?: '' | 'skill'; initialPackage?: string; onPluginStatus?: (plugin: RouterPlugin) => void; initialPlugin?: 'pi' | 'opencode' | '9router' | 'node' | ManagerPluginId | null }) {
  const { t } = useLanguage()
  const [details, setDetails] = useState<'9router' | 'pi' | 'node' | 'opencode' | ManagerPluginId | null>(initialPlugin)
  const [packageTarget, setPackageTarget] = useState<string | undefined>(initialPackage)
  const [tab, setTab] = useState('package')
  const [pluginSearch, setPluginSearch] = useState('')
  const [pluginCategory, setPluginCategory] = useState('')
  const search = pluginSearch.trim().toLocaleLowerCase()
  const visiblePlugins = pluginCatalog.filter(plugin => (!pluginCategory || plugin.category === pluginCategory) &&
    `${plugin.name} ${plugin.description} ${t(plugin.description)}`.toLocaleLowerCase().includes(search))
  // Catalog browsing state (page/search/type/sort) is kept here so it survives
  // opening and closing a package detail page.
  const [query, setQuery] = useState<PackageQuery>({ page: 1, search: '', type: initialType, sort: 'downloads' })
  const [selectedPackage, setSelectedPackage] = useState<PiPackage>()
  const [packageError, setPackageError] = useState('')

  useEffect(() => {
    if (!packageTarget) return
    let alive = true
    setPackageError('')
    void window.packages.detail(packageTarget).then(item => { if (alive) setSelectedPackage(item) }).catch(() => { if (alive) setPackageError('Cannot load package update details. Try again.') })
    return () => { alive = false }
  }, [packageTarget])

  // Package and plugin detail pages are standalone top-level pages (matching
  // RouterDetails' own shell: back-arrow toolbar, title, refresh, persistent
  // footer) rather than nested inside the Library heading/tab shell.
  if (details === 'node') return <NodeDetails onBack={() => { setDetails(null); setTab('plugin') }} />
  if (details) return <RouterDetails key={details} pi={details === 'pi'} opencode={details === 'opencode'} managerId={['pnpm', 'bun', 'yarn'].includes(details) ? details as ManagerPluginId : undefined} onStatus={onPluginStatus} onBack={() => { setDetails(null); setTab('plugin') }} />
  if (selectedPackage) return <PackageDetails key={selectedPackage.name} item={selectedPackage} onBack={() => { setSelectedPackage(undefined); setPackageTarget(undefined) }} />
  return <main className="library-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t("Library")}</h1><LibraryUpdates onView={item => item.kind === 'package' ? setPackageTarget(item.name) : setDetails(item.id as 'pi' | '9router' | 'opencode')} /></header>
    {packageError && <p className="plugin-error" role="alert">{t(packageError)}</p>}
    <Tabs.Root value={tab} onValueChange={({ value }) => setTab(value)} variant="line" fitted lazyMount unmountOnExit colorPalette="brand" className="library-tabs">
      <Tabs.List aria-label={t("Library categories")} className="library-tablist">
        <Tabs.Trigger value="package">{t("Packages")}</Tabs.Trigger>
        <Tabs.Trigger value="plugin">{t("Plugins")}</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Content value="package" className="library-content">
        <Packages
          query={query}
          onQueryChange={patch => setQuery(previous => ({ ...previous, ...patch }))}
          onSelect={setSelectedPackage}
        />
      </Tabs.Content>
      <Tabs.Content value="plugin" className="library-content">
        <div className="router-control-actions plugin-filters">
          <input type="search" aria-label={t('Search plugins')} placeholder={t('Search plugins…')} value={pluginSearch} onChange={event => setPluginSearch(event.target.value)} />
          <select aria-label={t('Plugin category')} value={pluginCategory} onChange={event => setPluginCategory(event.target.value)}>
            {Object.entries(pluginCategories).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
          </select>
        </div>
        <div className="plugin-library-grid">{visiblePlugins.map(({ id }) => id === '9router'
          ? <RouterCard key={id} onOpen={() => setDetails(id)} />
          : id === 'pi' ? <PiCard key={id} onOpen={() => setDetails(id)} />
          : <RuntimeCard key={id} kind={id} onOpen={() => setDetails(id)} />)}</div>
        {!visiblePlugins.length && <p role="status">{t('No matching plugins.')}</p>}
      </Tabs.Content>
    </Tabs.Root>
  </main>
}
