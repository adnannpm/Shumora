export interface UpdateState {
  status: 'unsupported' | 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error'
  currentVersion: string
  version?: string
  notes?: string
  percent?: number
  error?: string
  reason?: string
}
export interface UpdatesAPI {
  status(): Promise<UpdateState>
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  onState(callback: (state: UpdateState) => void): () => void
}
declare global { interface Window { updates: UpdatesAPI } }
