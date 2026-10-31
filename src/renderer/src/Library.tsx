import { useLanguage } from './Language'
import { useEffect, useState } from 'react'
import { Tabs } from '@chakra-ui/react'
import { Packages } from './Packages'
import { PackageDetails } from './PackageDetails'
import { LibraryUpdates } from './LibraryUpdates'
import { RouterCard, RouterDetails, PiCard } from './RouterPlugin'
import { RuntimeCard, NodeDetails } from './RuntimePlugins'
import type { ManagerPluginId, RouterPlugin } from '../../shared/plugins'
import type { PackageQuery, PiPackage } from '../../shared/packages'

export function Library({ onPluginStatus, initialPlugin = null }: { onPluginStatus?: (plugin: RouterPlugin) => void; initialPlugin?: 'pi' | 'opencode' | '9router' | 'node' | ManagerPluginId | null }) {
  const { t } = useLanguage()
  const [details, setDetails] = useState<'9router' | 'pi' | 'node' | 'opencode' | ManagerPluginId | null>(initialPlugin)
  const [packageTarget, setPackageTarget] = useState<string>()
  const [tab, setTab] = useState('package')
  // Catalog browsing state (page/search/type/sort) is kept here so it survives
  // opening and closing a package detail page.
  const [query, setQuery] = useState<PackageQuery>({ page: 1, search: '', type: '', sort: 'downloads' })
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
      <Tabs.Content value="plugin" className="library-content"><div className="plugin-library-grid"><RouterCard onOpen={() => setDetails('9router')} /><PiCard onOpen={() => setDetails('pi')} /><RuntimeCard kind="node" onOpen={() => setDetails('node')} /><RuntimeCard kind="opencode" onOpen={() => setDetails('opencode')} />{(['pnpm', 'bun', 'yarn'] as const).map(id => <RuntimeCard key={id} kind={id} onOpen={() => setDetails(id)} />)}</div></Tabs.Content>
    </Tabs.Root>
  </main>
}
