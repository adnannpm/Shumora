import Database from 'better-sqlite3'
import { expect, it } from 'vitest'
import { SessionManager } from '../src/main/sessions'
import { TerminalAgentSettings } from '../src/main/terminal-agent'
it('persists the agent for future sessions even with open tabs and rejects missing agents', async()=>{
 const db=new Database(':memory:')
 const settings=new TerminalAgentSettings(db,async agent=>agent==='pi')
 expect((await settings.status()).active).toBe('pi')
 await expect(settings.select('opencode')).rejects.toThrow('not installed')
 const both=new TerminalAgentSettings(db,async()=>true)
 const launched: string[] = []
 const sessions=new SessionManager(() => {
  launched.push(both.active())
  return { onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }
 }, () => {})
 const existing=sessions.create('/workspace')
 expect((await both.status()).canChange).toBe(true)
 expect((await both.select('opencode')).active).toBe('opencode')
 expect(sessions.snapshot(existing.id).session.status).toBe('running')
 expect(launched).toEqual(['pi'])
 sessions.create('/workspace')
 expect(launched).toEqual(['pi', 'opencode'])
 sessions.dispose()
 expect(new TerminalAgentSettings(db,async()=>true).active()).toBe('opencode')
 await expect(both.select('bad' as any)).rejects.toThrow('Invalid')
 db.close()
})
