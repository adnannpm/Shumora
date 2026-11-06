export const TERMINAL_AGENTS = ['pi', 'opencode'] as const
export type TerminalAgent = (typeof TERMINAL_AGENTS)[number]

export const TERMINAL_AGENT_LABELS: Record<TerminalAgent, string> = {
  pi: 'Pi',
  opencode: 'OpenCode'
}

export function isTerminalAgent(value: unknown): value is TerminalAgent {
  return value === 'pi' || value === 'opencode'
}

export function assertTerminalAgent(value: unknown, message = 'Invalid terminal agent'): asserts value is TerminalAgent {
  if (!isTerminalAgent(value)) throw new Error(message)
}

export interface TerminalAgentState {
  active: TerminalAgent
  canChange: boolean
  installed: Record<TerminalAgent, boolean>
}

export interface TerminalAgentAPI {
  status(): Promise<TerminalAgentState>
  select(agent: TerminalAgent): Promise<TerminalAgentState>
}

declare global {
  interface Window {
    terminalAgent?: TerminalAgentAPI
  }
}
