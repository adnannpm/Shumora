// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { ToolCacheSettings } from '../src/renderer/src/ToolCacheSettings'
afterEach(()=>{cleanup();delete window.toolCache})
it('shows measured cache size, confirms cleanup and displays actual freed bytes',async()=>{
 const entry = {id:'pi',name:'Pi',bytes:2048,files:2,supported:true,failed:false}
 window.toolCache={scan:vi.fn(async()=>({entries:[entry],totalBytes:2048})),clear:vi.fn(async()=>({entries:[{...entry,bytes:0,files:0}],totalBytes:0,freedBytes:2048}))}
 render(<Provider><ToolCacheSettings/></Provider>)
 await screen.findByText('2.0 KB')
 fireEvent.click(screen.getByRole('button',{name:'Clear cache'}))
 await screen.findByRole('dialog')
 expect(window.toolCache.clear).not.toHaveBeenCalled()
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Clear cache'}))
 await screen.findByText('Cleaned 2.0 KB of cache.')
 await screen.findByText('No cache needs cleaning.')
 await waitFor(()=>expect(screen.getByRole('button',{name:'Clear cache'}).hasAttribute('disabled')).toBe(true))
})
