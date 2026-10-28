import { accessSync, constants, existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess, execFile } from 'node:child_process'
import type { PluginHost } from './plugins'
import type { RouterHost } from './router-service'
import { routerHealth } from './router-health'
import { resolveLaunch, windowsPiPackageCandidates } from './launch'
export async function runPiPackage(args: string[], output: (text: string) => void): Promise<void> {
  const launch = resolveLaunch(process.platform, process.env, process.env.PATH || process.env.Path || '')
  await run(launch.file, [...launch.args, ...args], 300_000, output)
}
function executable(name: string): string | undefined {
  const dirs = (process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean)
  const names = process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, name] : [name]
  return dirs.flatMap(dir => names.map(n => path.join(dir, n))).find(file => { try { accessSync(file, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return true } catch { return false } })
}
function run(file: string, args: string[], timeout = 120_000, output?: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { timeout, maxBuffer: 1024 * 1024, windowsHide: true, env: { ...process.env, npm_config_update_notifier: 'false', NO_COLOR: '1' } }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${error.message}\n${stderr.slice(-4000)}`)); else resolve(stdout)
    })
    if (output) {
      child.stdout?.on('data', (text: string) => output(text))
      child.stderr?.on('data', (text: string) => output(text))
    }
  })
}
function npmCommand(): { file: string; args: string[] } {
  const npm = executable('npm')
  if (!npm) throw new Error('npm is not available on the application PATH. Install Node.js/npm and restart Shumora.')
  if (process.platform !== 'win32' || /\.exe$/i.test(npm)) return { file: npm, args: [] }
  const cli = path.join(path.dirname(npm), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const node = executable('node')
  if (!node || !existsSync(cli)) throw new Error('Cannot resolve npm CLI and node.exe. Run the npm command manually in your terminal.')
  return { file: node, args: [cli] }
}
export const routerHost: RouterHost = {
  health: routerHealth,
  async start(output, exit) {
    const installation = await pluginHost.detect()
    if (!installation.executable) throw new Error('9router is not installed')
    const node = executable('node')
    if (!node) throw new Error('Node.js is not available on PATH')
    // Launch the packaged server directly: the CLI creates detached children/tray processes.
    const dir = process.platform === 'win32'
      ? path.join(path.dirname(installation.executable), 'node_modules', '9router')
      : path.dirname(realpathSync(installation.executable))
    const server = path.join(dir, 'app', 'custom-server.js')
    if (!existsSync(server)) throw new Error('Unsupported 9router package layout. Start this installation manually.')
    const child = spawn(node, [server], { cwd: path.dirname(server), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '20128', HOSTNAME: '127.0.0.1', NO_COLOR: '1', ELECTRON_RUN_AS_NODE: undefined } })
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', output); child.stderr.on('data', output)
    child.once('exit', exit)
    await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
    return child
  },
  async stop(process) {
    const child = process as ChildProcess
    if (child.exitCode !== null || child.signalCode !== null) return
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
      child.once('exit', () => { clearTimeout(timer); resolve() })
      if (!child.kill('SIGTERM')) { clearTimeout(timer); reject(new Error('Could not stop managed 9router process')) }
    })
  }
}
export const pluginHost = createPluginHost('9router', '9router', 'decolua/9router')
export const piPluginHost = createPluginHost('pi', '@earendil-works/pi-coding-agent', 'earendil-works/pi')
function createPluginHost(command: string, packageName: string, repository: string): PluginHost { return {
  async detect() {
    const file = command === 'pi' && process.env.PI_EXECUTABLE ? process.env.PI_EXECUTABLE : executable(command)
    if (!file) return { installed: false }
    const real = realpathSync(file)
    let dir = path.dirname(real)
    // npm symlinks on Unix and .cmd shims on Windows have different layouts.
    const candidates = command === 'pi' && process.platform === 'win32'
      ? windowsPiPackageCandidates(process.env, path.win32.dirname(file))
      : [path.join(path.dirname(file), 'node_modules', packageName, 'package.json')]
    for (let i = 0; i < 5; i++) { candidates.push(path.join(dir, 'package.json')); dir = path.dirname(dir) }
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue
      const pkg = JSON.parse(readFileSync(candidate, 'utf8'))
      if (pkg.name === packageName && typeof pkg.version === 'string') return { installed: true, installedVersion: pkg.version, executable: file }
    }
    throw new Error(`${command} exists at ${file}, but its package version could not be verified. Manage this installation manually.`)
  },
  async catalog() {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`)
    const pkg = await response.json() as { version?: string }
    if (!pkg.version || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Registry did not return a stable version')
    let changelog = 'No matching release notes were found for this npm version.'
    const release = await fetch(`https://api.github.com/repos/${repository}/releases/tags/v${pkg.version}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) })
    if (release.ok) { const data = await release.json() as { body?: string }; changelog = data.body?.slice(0, 100_000) || changelog }
    return { latestVersion: pkg.version, changelog }
  },
  async run(args, output) {
    const npm = npmCommand()
    if (args[0] === 'uninstall' || args[0] === 'install') {
      const current = command === 'pi' && process.env.PI_EXECUTABLE ? process.env.PI_EXECUTABLE : executable(command)
      if (current) {
        const root = (await run(npm.file, [...npm.args, 'root', '--global'], 15_000)).trim()
        const packageDir = path.join(root, packageName)
        const owned = existsSync(packageDir) && (process.platform === 'win32'
          ? path.dirname(current).toLowerCase() === path.dirname(root).toLowerCase()
          : realpathSync(current).startsWith(realpathSync(packageDir) + path.sep))
        if (!owned) throw new Error(`The ${command} installation is not owned by the active npm global prefix. Manage it manually to avoid changing another installation.`)
      }
    }
    // Fixed argv only, no shell, sudo, password prompting or arbitrary package names.
    await run(npm.file, [...npm.args, ...args], 120_000, output)
  }
} }
