import type Database from 'better-sqlite3'
import type { TerminalAgent, TerminalAgentState } from '../shared/terminal-agent'
export class TerminalAgentSettings {
 constructor(private db: Database.Database, private installed:(agent:TerminalAgent)=>Promise<boolean>) {
  db.exec('CREATE TABLE IF NOT EXISTS terminal_agent (id INTEGER PRIMARY KEY CHECK(id=1), agent TEXT NOT NULL)')
 }
 active():TerminalAgent { const row=this.db.prepare('SELECT agent FROM terminal_agent WHERE id=1').get() as {agent:string}|undefined;return row?.agent==='opencode'?'opencode':'pi' }
 async status():Promise<TerminalAgentState> { const [pi,opencode]=await Promise.all([this.installed('pi'),this.installed('opencode')]);return {active:this.active(),canChange:true,installed:{pi,opencode}} }
 async select(agent:TerminalAgent) {
  if(agent!=='pi'&&agent!=='opencode')throw new Error('Invalid terminal agent')
  if(agent===this.active())return this.status()
  // This preference is read at launch; existing processes keep their current agent.
  if(!await this.installed(agent))throw new Error('The selected agent is not installed')
  this.db.prepare('INSERT INTO terminal_agent(id,agent) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET agent=excluded.agent').run(agent)
  return this.status()
 }
}
