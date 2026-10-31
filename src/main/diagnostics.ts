import { execFile } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { resolveLaunch } from './launch'
import type { DiagnosticReport } from '../shared/diagnostics'

export function redactDiagnosticText(text: string, env: NodeJS.ProcessEnv): string {
  let result = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  for (const home of [env.HOME, env.USERPROFILE].filter((value): value is string => !!value).sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<HOME>')
  }
  for (const [key, value] of Object.entries(env)) {
    if (value && /token|secret|password|credential|api[_-]?key|authorization/i.test(key)) result = result.split(value).join('<REDACTED>')
  }
  return result
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1<REDACTED>@')
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1<REDACTED>')
    .replace(/((?:[\w-]*(?:token|secret|password|api[_-]?key|authorization)[\w-]*)["']?\s*[:=]\s*["']?)[^\s&;"']+/gi, '$1<REDACTED>')
    .replace(/\bsk-[a-zA-Z0-9_-]{16,}/g, '<REDACTED>')
    .slice(0, 16000)
}

function versionProbe(file: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    // No shell, stdin, login, package installation, or agent prompt. Bound both time and output.
    const child = execFile(file, args, { timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true, env: { ...env, ELECTRON_RUN_AS_NODE: undefined, NO_COLOR: '1' } }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${error.message}\n${stderr}`)); else resolve(stdout.trim())
    })
    child.stdin?.end()
  })
}

export async function collectDiagnostics(deps: {
  platform?: string; env?: NodeJS.ProcessEnv
  resolve?: typeof resolveLaunch; exists?: (file: string) => boolean
  realpath?: (file: string) => string
  run?: (file: string, args: string[], env: NodeJS.ProcessEnv) => Promise<string>
} = {}): Promise<DiagnosticReport> {
  const platform = deps.platform || process.platform
  const env = deps.env || process.env
  const exists = deps.exists || existsSync
  const run = deps.run || versionProbe
  const p = platform === 'win32' ? path.win32 : path.posix
  const search = env.PATH || env.Path || ''
  const dirs = search.split(platform === 'win32' ? ';' : ':').filter(Boolean)
  const report: DiagnosticReport = { platform, pi: { installation: 'Unknown' }, node: {}, launch: { args: [], ok: false, output: '' }, path: dirs }
  try {
    const launch = (deps.resolve || resolveLaunch)(platform, env, search)
    report.launch.file = launch.file; report.launch.args = launch.args
    report.pi.executable = launch.args[0] || launch.file
    let identity = report.pi.executable
    try { identity += ' ' + (deps.realpath || realpathSync)(report.pi.executable) } catch { /* Missing/unresolvable links remain visible in probe results. */ }
    const normalized = identity.replace(/\\/g, '/').toLowerCase()
    report.pi.installation = /pi-launcher\.js|\/\.pi\/agent\/(bin|install)\//.test(normalized) ? 'Official installer'
      : normalized.includes('/.bun/') ? 'Bun' : normalized.includes('/node_modules/') ? 'npm' : 'Unknown'
    if (/node(?:\.exe)?$/i.test(launch.file)) report.node.executable = launch.file
    try {
      const output = await run(launch.file, [...launch.args, '--version'], env)
      report.pi.version = output; report.launch.output = output; report.launch.ok = true
    } catch (error) { report.pi.error = String(error); report.launch.output = String(error) }
  } catch (error) { report.pi.error = String(error); report.launch.output = String(error) }
  report.node.executable ||= env.PI_NODE_EXECUTABLE || dirs.map(dir => p.join(dir, platform === 'win32' ? 'node.exe' : 'node')).find(exists)
  if (report.node.executable) {
    try { report.node.version = await run(report.node.executable, ['--version'], env) } catch (error) { report.node.error = String(error) }
  } else report.node.error = 'Node executable not found on the application PATH.'
  // Sanitize every string before it crosses IPC; the renderer and clipboard never receive raw output.
  return JSON.parse(JSON.stringify(report, (_key, value) => typeof value === 'string' ? redactDiagnosticText(value, env) : value))
}
