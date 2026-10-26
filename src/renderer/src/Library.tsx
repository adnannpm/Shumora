import { useState } from 'react'
import { Tabs } from '@chakra-ui/react'
import { Packages } from './Packages'
import { LibraryUpdates } from './LibraryUpdates'
import { RouterCard, RouterDetails, PiCard } from './RouterPlugin'
import type { RouterPlugin } from '../../shared/plugins'

export function Library({ onPluginStatus, initialPlugin = null }: { onPluginStatus?: (plugin: RouterPlugin) => void; initialPlugin?: 'pi' | '9router' | null }) {
  const [details, setDetails] = useState<'9router' | 'pi' | null>(initialPlugin)
  const [packageTarget, setPackageTarget] = useState<string>()
  const [tab, setTab] = useState('package')
  if (details) return <RouterDetails key={details} pi={details === 'pi'} onStatus={onPluginStatus} onBack={() => { setDetails(null); setTab('plugin') }} />
  return <main className="library-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>Library</h1></header>
    <Tabs.Root value={tab} onValueChange={({ value }) => setTab(value)} variant="line" fitted lazyMount unmountOnExit colorPalette="brand" className="library-tabs">
      <Tabs.List aria-label="Library categories" className="library-tablist">
        <Tabs.Trigger value="package">Package</Tabs.Trigger>
        <Tabs.Trigger value="plugin">Plugin</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Content value="package" className="library-content"><Packages initialPackage={packageTarget} onBack={() => setPackageTarget(undefined)} banner={<LibraryUpdates scope="package" onView={item => setPackageTarget(item.name)} />} /></Tabs.Content>
      <Tabs.Content value="plugin" className="library-content"><LibraryUpdates scope="plugin" onView={item => setDetails(item.id as 'pi' | '9router')} /><div className="plugin-library-grid"><RouterCard onOpen={() => setDetails('9router')} /><PiCard onOpen={() => setDetails('pi')} /></div></Tabs.Content>
    </Tabs.Root>
  </main>
}
