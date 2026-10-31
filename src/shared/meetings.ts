export interface MeetingParticipant { id: string; name: string; role: string }
export interface MeetingInput { agenda: string; participants: MeetingParticipant[]; leader: string; language: 'en' | 'id' | 'zh' }
export interface MeetingMessage { author: string; text: string; kind: 'response' | 'direction' | 'summary' }
export interface MeetingState {
  revision: number
  phase: 'setup' | 'running' | 'paused' | 'completed' | 'stopped'
  agenda: string
  participants: MeetingParticipant[]
  leader: string
  messages: MeetingMessage[]
  awaitingUser?: boolean
  speaker?: string
  round: number
  error?: string
}
export interface MeetingSnapshot { state: MeetingState; agents: Record<string, 'ready' | 'busy' | 'disconnected'> }
export interface MeetingsAPI {
  snapshot(): Promise<MeetingSnapshot>
  start(input: MeetingInput): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
  takeOver(): Promise<void>
  direction(text: string): Promise<void>
  onChange(callback: (snapshot: MeetingSnapshot) => void): () => void
}
declare global { interface Window { meetings?: MeetingsAPI } }
