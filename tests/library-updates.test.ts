import { expect, it, vi } from 'vitest'
import { checkLibraryUpdates } from '../src/main/library-updates'
it('isolates plugin checks from package failures and package checks from plugin failures', async () => {
  const names = vi.fn(() => { throw new Error('Broken package settings') })
  const plugin = vi.fn(async () => { throw new Error('Plugin network failure') })
  const host = { names, status: () => ({ installed: false, configured: false }), latest: async () => '1.0.0', plugins: [{ id: 'pi' as const, check: plugin }] }
  const pluginResult = await checkLibraryUpdates(host, 'plugin')
  expect(names).not.toHaveBeenCalled()
  expect(pluginResult.errors).toEqual(['Could not check plugin pi'])
  plugin.mockClear()
  const packageResult = await checkLibraryUpdates(host, 'package')
  expect(plugin).not.toHaveBeenCalled()
  expect(packageResult.errors).toEqual(['Could not read personal Pi package configuration'])
})
it('counts only newer versions and preserves independent failures', async () => {
  const result = await checkLibraryUpdates({
    names: () => ['older', 'current', 'ahead', 'broken'],
    status: name => ({ configured: true, installed: true, installedVersion: name === 'ahead' ? '3.0.0' : '1.0.0' }),
    latest: async name => { if (name === 'broken') throw new Error(); return name === 'current' ? '1.0.0' : '2.0.0' },
    plugins: [ { id: 'pi', check: async () => ({ installed: true, installedVersion: '1.0.0', latestVersion: '1.1.0' }) }, { id: '9router', check: async () => ({ installed: false, latestVersion: '1.0.0' }) } ]
  })
  expect(result.items.map(i => i.id)).toEqual(['older', 'pi'])
  expect(result.errors).toEqual(['Could not check package broken'])
})
