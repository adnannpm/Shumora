import { useLanguage } from './Language'
import { useEffect, useState } from 'react'
import { Tabs } from '@chakra-ui/react'
import { Packages } from './Packages'
import { PackageDetails } from './PackageDetails'
import { LibraryUpdates } from './LibraryUpdates'
import { RouterCard, RouterDetails, PiCard } from './RouterPlugin'
import type { RouterPlugin } from '../../shared/plugins'
import type { PackageQuery, PiPackage } from '../../shared/packages'

export function Library({ onPluginStatus, initialPlugin = null }: { onPluginStatus?: (plugin: RouterPlugin) => void; initialPlugin?: 'pi' | '9router' | null }) {
  const { t } = useLanguage()
  const [details, setDetails] = useState<'9router' | 'pi' | null>(initialPlugin)
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
  if (details) return <RouterDetails key={details} pi={details === 'pi'} onStatus={onPluginStatus} onBack={() => { setDetails(null); setTab('plugin') }} />
  if (selectedPackage) return <PackageDetails key={selectedPackage.name} item={selectedPackage} onBack={() => { setSelectedPackage(undefined); setPackageTarget(undefined) }} />
  return <main className="library-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>{t("Library")}</h1></header>
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
          banner={<LibraryUpdates scope="package" onView={item => setPackageTarget(item.name)} />}
        />
      </Tabs.Content>
      <Tabs.Content value="plugin" className="library-content"><LibraryUpdates scope="plugin" onView={item => setDetails(item.id as 'pi' | '9router')} /><div className="plugin-library-grid"><RouterCard onOpen={() => setDetails('9router')} /><PiCard onOpen={() => setDetails('pi')} /></div></Tabs.Content>
    </Tabs.Root>
  </main>
}
