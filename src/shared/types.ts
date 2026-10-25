export interface Session {
  id: string
  name: string
  cwd: string
  status: 'running' | 'exited' | 'error'
  generation: number
  error?: string
  exitCode?: number
}
export interface Snapshot { session: Session; output: string; seq: number }
export type SessionEvent = { type: 'removed'; id: string } | { type: 'state'; session: Session } | { type: 'data'; id: string; generation: number; seq: number; data: string }
export interface WorkspaceAPI {
  list(): Promise<Session[]>
  create(): Promise<Session>
  snapshot(id: string): Promise<Snapshot>
  input(id: string, data: string): Promise<void>
  resize(id: string, cols: number, rows: number): Promise<void>
  close(id: string): Promise<boolean>
  stop(id: string): Promise<void>
  restart(id: string): Promise<Session>
  folder(): Promise<string>
  chooseFolder(): Promise<string>
  onEvent(callback: (event: SessionEvent) => void): () => void
}
declare global { interface Window { workspace: WorkspaceAPI } }
