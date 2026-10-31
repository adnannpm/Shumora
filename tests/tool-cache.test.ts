import { mkdtemp, mkdir, writeFile, symlink, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { ToolCache } from '../src/main/tool-cache'
it('counts only approved cache files and clears them without touching sessions or model downloads', async () => {
 const home = await mkdtemp(join(tmpdir(), 'shumora-cache-'))
 try {
  await mkdir(join(home,'.cache/pi'),{recursive:true}); await mkdir(join(home,'.cache/opencode/bin'),{recursive:true}); await mkdir(join(home,'.pi/agent'),{recursive:true})
  await writeFile(join(home,'.cache/pi/9router-discovery-cache.json'),'1234')
  await writeFile(join(home,'.cache/opencode/models.json'),'123456')
  await writeFile(join(home,'.cache/opencode/bin/rg'),'keep')
  await writeFile(join(home,'.pi/agent/auth.json'),'secret')
  const cache = new ToolCache(home,join(home,'.cache'))
  expect((await cache.scan()).totalBytes).toBe(10)
  const result = await cache.clear()
  expect(result.freedBytes).toBe(10)
  expect(result.totalBytes).toBe(0)
  expect(await readFile(join(home,'.pi/agent/auth.json'),'utf8')).toBe('secret')
  expect(await readFile(join(home,'.cache/opencode/bin/rg'),'utf8')).toBe('keep')
 } finally { await rm(home,{recursive:true,force:true}) }
})
it('never traverses symbolic links at cache roots or files', async () => {
 const home = await mkdtemp(join(tmpdir(), 'shumora-cache-'))
 try {
  await mkdir(join(home,'outside'),{recursive:true}); await writeFile(join(home,'outside/models.json'),'secret')
  await mkdir(join(home,'.cache'),{recursive:true}); await symlink(join(home,'outside'),join(home,'.cache/opencode'),'dir')
  const cache = new ToolCache(home,join(home,'.cache'))
  expect((await cache.scan()).totalBytes).toBe(0)
  await cache.clear()
  expect(await readFile(join(home,'outside/models.json'),'utf8')).toBe('secret')
 } finally { await rm(home,{recursive:true,force:true}) }
})
