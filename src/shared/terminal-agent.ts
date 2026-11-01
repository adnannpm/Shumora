export type TerminalAgent = 'pi' | 'opencode'
export interface TerminalAgentState { active: TerminalAgent; canChange: boolean; installed: Record<TerminalAgent, boolean> }
export interface TerminalAgentAPI { status(): Promise<TerminalAgentState>; select(agent: TerminalAgent): Promise<TerminalAgentState> }
declare global { interface Window { terminalAgent?: TerminalAgentAPI } }
