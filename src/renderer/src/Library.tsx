import { useState } from 'react'
import { Tabs } from '@chakra-ui/react'
import { RouterCard, RouterDetails } from './RouterPlugin'
import type { RouterPlugin } from '../../shared/plugins'

export function Library({ onPluginStatus }: { onPluginStatus?: (plugin: RouterPlugin) => void }) {
  const [details, setDetails] = useState(false)
  const [tab, setTab] = useState('package')
  if (details) return <RouterDetails onStatus={onPluginStatus} onBack={() => { setDetails(false); setTab('plugin') }} />
  return <main className="library-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar"><h1>Library</h1></header>
    <Tabs.Root value={tab} onValueChange={({ value }) => setTab(value)} variant="line" fitted colorPalette="brand" className="library-tabs">
      <Tabs.List aria-label="Library categories" className="library-tablist">
        <Tabs.Trigger value="package">Package</Tabs.Trigger>
        <Tabs.Trigger value="plugin">Plugin</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Content value="package" className="library-content"><h2>No packages yet</h2><p>Packages will appear here when library management is available.</p></Tabs.Content>
      <Tabs.Content value="plugin" className="library-content"><RouterCard onOpen={() => setDetails(true)} /></Tabs.Content>
    </Tabs.Root>
  </main>
}
