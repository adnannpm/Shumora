export interface DiagnosticReport {
  platform: string
  pi: { executable?: string; version?: string; installation: 'npm' | 'Bun' | 'Official installer' | 'Unknown'; error?: string }
  node: { executable?: string; version?: string; error?: string }
  launch: { file?: string; args: string[]; ok: boolean; output: string }
  path: string[]
}
export interface DiagnosticsAPI { run(): Promise<DiagnosticReport> }
declare global { interface Window { diagnostics: DiagnosticsAPI } }
