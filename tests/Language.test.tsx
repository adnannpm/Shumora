// @vitest-environment jsdom
import React from 'react'
import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { translate } from '../src/renderer/src/Language'
import { chinese } from '../src/renderer/src/locales/zh'
import { indonesian } from '../src/renderer/src/locales/id'
import { Settings } from '../src/renderer/src/Settings'
import { Sidebar } from '../src/renderer/src/Sidebar'
import { MeetingRoom } from '../src/renderer/src/MeetingRoom'
import { Packages } from '../src/renderer/src/Packages'
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: () => <div>Raw AI terminal output</div> }))
function UI() {
  return <Provider><Sidebar page="settings" onPage={() => {}} collapsed={false} onToggle={() => {}} routerInstalled={false} /><Settings /><MeetingRoom sessions={[]} /></Provider>
}
beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: new JSDOM('', { url: 'https://shumora.test' }).window.localStorage })
})
afterEach(() => { cleanup(); delete window.meetings; vi.restoreAllMocks() })
it('defaults to English and immediately translates settings, navigation and meetings', () => {
  window.meetings = { snapshot: async () => ({ state: { revision: 0, phase: 'setup', agenda: '', participants: [], leader: 'user', messages: [], round: 0 }, agents: {} }), onChange: () => () => {} } as any
  render(<UI />)
  expect(document.documentElement.lang).toBe('en')
  expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe('en')
  fireEvent.change(screen.getByLabelText('Discussion topic'), { target: { value: 'Keep my English agenda' } })
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'id' } })
  expect(document.documentElement.lang).toBe('id')
  expect(screen.getByRole('heading', { name: 'Pengaturan' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Council' })).toBeTruthy()
  expect((screen.getByLabelText('Topik diskusi') as HTMLTextAreaElement).value).toBe('Keep my English agenda')
  expect(window.localStorage.getItem('shumora.language')).toBe('id')
  fireEvent.change(screen.getByLabelText('Bahasa'), { target: { value: 'en' } })
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
})
it('selects and restores Simplified Chinese without changing user content', () => {
  window.meetings = { snapshot: async () => ({ state: { revision: 0, phase: 'setup', agenda: '', participants: [], leader: 'user', messages: [], round: 0 }, agents: {} }), onChange: () => () => {} } as any
  const view = render(<UI />)
  fireEvent.change(screen.getByLabelText('Discussion topic'), { target: { value: 'My original agenda' } })
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh' } })
  expect(screen.getByRole('heading', { name: '设置' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '议事会' })).toBeTruthy()
  expect((screen.getByLabelText('讨论主题') as HTMLTextAreaElement).value).toBe('My original agenda')
  expect(document.documentElement.lang).toBe('zh-CN')
  expect(window.localStorage.getItem('shumora.language')).toBe('zh')
  view.unmount()
  render(<UI />)
  expect((screen.getByLabelText('语言') as HTMLSelectElement).value).toBe('zh')
  fireEvent.change(screen.getByLabelText('语言'), { target: { value: 'en' } })
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
})
it('covers existing locale keys and preserves interpolation placeholders', () => {
  expect(Object.keys(indonesian).filter(key => !chinese[key])).toEqual([])
  for (const [key, value] of Object.entries(chinese)) expect(value.match(/\{\w+\}/g)?.sort() || []).toEqual(key.match(/\{\w+\}/g)?.sort() || [])
  expect(translate('zh', '{count} roles', { count: 3 })).toBe('3 个角色')
  expect(translate('zh', 'Untranslated remote content')).toBe('Untranslated remote content')
})
it('restores Indonesian on remount', () => {
  window.localStorage.setItem('shumora.language', 'id')
  const view = render(<UI />)
  expect(screen.getByRole('heading', { name: 'Pengaturan' })).toBeTruthy()
  view.unmount()
  render(<UI />)
  expect(screen.getByRole('heading', { name: 'Pengaturan' })).toBeTruthy()
})
it('keeps remote package descriptions and names unchanged in Indonesian', async () => {
  window.localStorage.setItem('shumora.language', 'id')
  window.packages = { catalog: async () => ({ items: [{ name: 'English-package-name', description: 'Original English description', author: 'Author', types: ['theme'], downloads: 5, version: '1.0.0' }], page: 1, pages: 1 }) } as any
  render(<Provider><Packages query={{}} onQueryChange={() => {}} onSelect={() => {}} /></Provider>)
  expect(await screen.findByText('Original English description')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Lihat English-package-name' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeTruthy()
})
it('allows changing language even when preference storage is unavailable', () => {
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
  render(<UI />)
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'id' } })
  expect(screen.getByRole('heading', { name: 'Pengaturan' })).toBeTruthy()
})
it('falls back to English for an unsupported preference', () => {
  window.localStorage.setItem('shumora.language', 'fr')
  render(<UI />)
  expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe('en')
})
