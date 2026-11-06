import { accessSync, constants, existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess, execFile } from 'node:child_process'
import type { PluginHost } from './plugins'
import type { ManagerPluginId, PackageManager } from '../shared/plugins'
import { packageManagerNames, managerRootArgs } from './package-managers'
import type { RouterHost } from './router-service'
import { routerHealth } from './router-health'
import { resolveLaunch, windowsPiPackageCandidates } from './launch'
import { commandFailure, windowsShimTargetsPackage } from './plugin-installation'

const MANAGER_COMMANDS: readonly string[] = ['pnpm', 'bun', 'yarn']

function isManagerPluginCommand(command: string): command is ManagerPluginId {
  return MANAGER_COMMANDS.includes(command)
}

function targetPath() {
  // Follow the target platform, not the host path module, so PATH parsing stays consistent.
  return process.platform === 'win32' ? path.win32 : path.posix
}

function normalizeTargetPath(value: string): string {
  const paths = targetPath()
  const resolved = paths.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function parseOpenCodeVersion(output: string): string {
  return output.replace(/^opencode\s+/, '').replace(/^v/, '')
}

export async function runPiPackage(args: string[], output: (text: string) => void): Promise<void> {
  const launch = resolveLaunch(process.platform, process.env, process.env.PATH || process.env.Path || '')
  await run(launch.file, [...launch.args, ...args], 300_000, output)
}

function executable(name: string): string | undefined {
  const paths = targetPath()
  const sep = process.platform === 'win32' ? ';' : ':'
  const dirs = (process.env.PATH || process.env.Path || '').split(sep).filter(Boolean)
  const names = process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, name] : [name]
  const accessMode = process.platform === 'win32' ? constants.F_OK : constants.X_OK

  return dirs
    .flatMap(dir => names.map(candidate => paths.join(dir, candidate)))
    .find(file => {
      try {
        accessSync(file, accessMode)
        return true
      } catch {
        return false
      }
    })
}

export function installTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.SHUMORA_INSTALL_TIMEOUT_MS)
  return Number.isSafeInteger(value) && value >= 120_000 && value <= 3_600_000 ? value : 900_000
}

function run(file: string, args: string[], timeout = 120_000, output?: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const options = {
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, npm_config_update_notifier: 'false', NO_COLOR: '1' }
    }

    const child = execFile(file, args, options, (error, stdout, stderr) => {
      if (!error) {
        resolve(stdout)
        return
      }
      const reason =
        error.killed && Date.now() - started >= timeout
          ? 'timeout'
          : error.signal
            ? 'signal'
            : typeof error.code === 'number'
              ? 'nonzero exit'
              : 'spawn or buffer failure'
      reject(
        new Error(
          `${commandFailure(error, stdout, stderr)}\nTermination reason: ${reason}; timeout: ${timeout} ms; executable: ${file}`
        )
      )
    })

    if (output) {
      child.stdout?.on('data', (text: string) => output(text))
      child.stderr?.on('data', (text: string) => output(text))
    }
  })
}

function managerCommand(manager: PackageManager): { file: string; args: string[] } {
  const file = executable(manager)
  if (!file) {
    throw new Error(`${manager} is not available on the application PATH. Restart Shumora after installing it.`)
  }
  if (process.platform !== 'win32' || /\.exe$/i.test(file)) {
    return { file, args: [] }
  }

  const paths = path.win32
  const bin = paths.dirname(file)
  const relative =
    manager === 'npm'
      ? 'npm/bin/npm-cli.js'
      : manager === 'pnpm'
        ? 'pnpm/bin/pnpm.cjs'
        : 'yarn/bin/yarn.js'
  const candidates = [
    paths.join(bin, 'node_modules', relative),
    paths.join(bin, 'node_modules/corepack/dist', `${manager}.js`)
  ]
  const cli = candidates.find(candidate => existsSync(candidate))
  const node = executable('node')
  if (!node || !cli) {
    throw new Error(`Cannot safely resolve ${manager} CLI and node.exe. Manage this installation manually.`)
  }
  return { file: node, args: [cli] }
}

async function availableManagers(): Promise<PackageManager[]> {
  const available: PackageManager[] = []
  for (const manager of packageManagerNames) {
    try {
      const cli = managerCommand(manager)
      const version = (await run(cli.file, [...cli.args, '--version'], 5000)).trim()
      // Yarn 2+ deliberately removed global installs.
      if (/^\d+\./.test(version) && (manager !== 'yarn' || /^1\./.test(version))) {
        available.push(manager)
      }
    } catch {
      /* Missing or unsupported manager is not offered. */
    }
  }
  return available
}

async function managerPackageDir(manager: PackageManager, packageName: string): Promise<string> {
  const cli = managerCommand(manager)
  const location = (await run(cli.file, [...cli.args, ...managerRootArgs(manager)], 15000)).trim()
  const paths = targetPath()
  if (!paths.isAbsolute(location)) {
    throw new Error(`Cannot verify ${manager} global location`)
  }
  if (manager === 'bun') {
    const global =
      process.env.BUN_INSTALL_GLOBAL_DIR ||
      paths.join(process.env.BUN_INSTALL || paths.dirname(location), 'install', 'global')
    return paths.join(global, 'node_modules', packageName)
  }
  return paths.join(location, ...(manager === 'yarn' ? ['node_modules'] : []), packageName)
}

async function managerInstallation(manager: PackageManager, command: string, packageName: string) {
  const paths = targetPath()
  const dir = await managerPackageDir(manager, packageName)
  const pkg = JSON.parse(readFileSync(paths.join(dir, 'package.json'), 'utf8'))
  if (pkg.name !== packageName || typeof pkg.version !== 'string') return undefined

  const cli = managerCommand(manager)
  const binArgs =
    manager === 'npm'
      ? ['prefix', '--global']
      : manager === 'yarn'
        ? ['global', 'bin']
        : manager === 'bun'
          ? ['pm', 'bin', '--global']
          : ['bin', '--global']
  const location = (await run(cli.file, [...cli.args, ...binArgs], 15000)).trim()
  if (!paths.isAbsolute(location)) {
    throw new Error(`Cannot verify ${manager} global bin location`)
  }

  const bin = manager === 'npm' && process.platform !== 'win32' ? paths.join(location, 'bin') : location
  const names = process.platform === 'win32' ? [`${command}.exe`, `${command}.cmd`, command] : [command]
  const file = names.map(name => paths.join(bin, name)).find(candidate => existsSync(candidate))
  if (!file) return undefined

  // A package manifest alone must not authorize an unrelated Windows shim.
  if (process.platform === 'win32' && /\.cmd$/i.test(file)) {
    if (!windowsShimTargetsPackage(file, readFileSync(file, 'utf8'), dir)) return undefined
  }
  if (process.platform === 'win32' && /\.exe$/i.test(file)) {
    const version = (await run(file, ['--version'], 15000)).trim().replace(/^v/, '')
    if (version !== pkg.version) {
      throw new Error(
        `Global executable ${file} reports ${version}, but ${paths.join(dir, 'package.json')} declares ${pkg.version}`
      )
    }
  }
  return { installedVersion: pkg.version, executable: file }
}

function addGlobalBin(file: string) {
  const paths = targetPath()
  const sep = process.platform === 'win32' ? ';' : ':'
  const bin = paths.dirname(file)
  const current = process.env.PATH || process.env.Path || ''
  const alreadyInPath = current
    .split(sep)
    .some(dir => (process.platform === 'win32' ? dir.toLowerCase() === bin.toLowerCase() : dir === bin))
  if (!alreadyInPath) {
    process.env.PATH = [current, bin].filter(Boolean).join(sep)
  }
}

async function installationOwner(
  file: string,
  packageName: string,
  managers: PackageManager[]
): Promise<PackageManager | undefined> {
  const paths = targetPath()
  for (const manager of managers) {
    try {
      const dir = await managerPackageDir(manager, packageName)
      const manifestPath = paths.join(dir, 'package.json')
      if (!existsSync(manifestPath)) continue

      const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (pkg.name !== packageName) continue

      const realDir = realpathSync(dir)
      const realFile = realpathSync(file)
      if (normalizeTargetPath(realFile).startsWith(normalizeTargetPath(realDir) + paths.sep)) {
        return manager
      }

      // Bun's Windows global launcher can be a native .exe rather than a text shim.
      if (
        manager === 'bun' &&
        process.platform === 'win32' &&
        /\.exe$/i.test(file) &&
        packageName === '@earendil-works/pi-coding-agent'
      ) {
        const installed = await managerInstallation(manager, 'pi', packageName)
        if (installed && normalizeTargetPath(realFile) === normalizeTargetPath(realpathSync(installed.executable))) {
          return manager
        }
      }

      if (process.platform === 'win32' && /\.(cmd|ps1)$/i.test(file)) {
        if (windowsShimTargetsPackage(file, readFileSync(file, 'utf8'), realDir)) {
          return manager
        }
      }
    } catch {
      /* An unverifiable location must never authorize mutation. */
    }
  }
}

export const routerHost: RouterHost = {
  health: routerHealth,
  async start(output, exit) {
    const installation = await pluginHost.detect()
    if (!installation.executable) throw new Error('9router is not installed')
    const node = executable('node')
    if (!node) throw new Error('Node.js is not available on PATH')

    // Launch the packaged server directly: the CLI creates detached children/tray processes.
    const dir =
      process.platform === 'win32'
        ? path.join(path.dirname(installation.executable), 'node_modules', '9router')
        : path.dirname(realpathSync(installation.executable))
    const server = path.join(dir, 'app', 'custom-server.js')
    if (!existsSync(server)) {
      throw new Error('Unsupported 9router package layout. Start this installation manually.')
    }

    const child = spawn(node, [server], {
      cwd: path.dirname(server),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: '20128',
        HOSTNAME: '127.0.0.1',
        NO_COLOR: '1',
        ELECTRON_RUN_AS_NODE: undefined
      }
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', output)
    child.stderr.on('data', output)
    child.once('exit', exit)
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
    })
    return child
  },
  async stop(process) {
    const child = process as ChildProcess
    if (child.exitCode !== null || child.signalCode !== null) return
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
      if (!child.kill('SIGTERM')) {
        clearTimeout(timer)
        reject(new Error('Could not stop managed 9router process'))
      }
    })
  }
}

export const pluginHost = createPluginHost('9router', '9router', 'decolua/9router')
export const piPluginHost = createPluginHost('pi', '@earendil-works/pi-coding-agent', 'earendil-works/pi')
export const opencodePluginHost = createPluginHost('opencode', 'opencode-ai', 'anomalyco/opencode')
export const managerPluginHosts = {
  pnpm: createPluginHost('pnpm', 'pnpm', 'pnpm/pnpm'),
  bun: createPluginHost('bun', 'bun', 'oven-sh/bun'),
  yarn: createPluginHost('yarn', 'yarn', 'yarnpkg/yarn')
} satisfies Record<ManagerPluginId, PluginHost>

export function resolveOpenCodeLaunch(): { file: string; args: string[] } {
  const file = executable('opencode')
  if (!file) throw new Error('OpenCode is not installed or is not available on PATH.')
  if (process.platform !== 'win32' || /\.exe$/i.test(file)) return { file, args: [] }

  const node = executable('node')
  const cli = path.win32.join(path.win32.dirname(file), 'node_modules', 'opencode-ai', 'bin', 'opencode')
  if (!node || !existsSync(cli)) {
    throw new Error(
      'Cannot safely start this OpenCode Windows installation. Use a native OpenCode executable or an npm installation.'
    )
  }
  return { file: node, args: [cli] }
}

export async function detectNode() {
  const file = executable('node')
  if (!file || (process.platform === 'win32' && !/\.exe$/i.test(file))) {
    return { installed: false }
  }
  const version = (await run(file, ['--version'], 5000)).trim()
  if (!/^v\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Cannot verify the Node.js installation on PATH')
  }
  return { installed: true, installedVersion: version.slice(1), executable: file }
}

function resolveWindowsPiInstallerPackage(file: string, packageName: string): string | undefined {
  if (process.platform !== 'win32') return undefined
  const p = path.win32
  const install = p.resolve(p.dirname(file), '..', 'install')
  try {
    const version = readFileSync(p.join(install, 'current-version'), 'utf8').trim()
    const hasLauncher = existsSync(p.join(p.dirname(file), 'pi-launcher.js'))
    if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) && hasLauncher) {
      return p.join(install, 'releases', version, 'node_modules', packageName, 'package.json')
    }
  } catch {
    /* Not the versioned installer layout. */
  }
  return undefined
}

function createPluginHost(command: string, packageName: string, repository: string): PluginHost {
  const supportedManagers = async () => {
    const managers = await availableManagers()
    return managers.filter(manager => !isManagerPluginCommand(command) || manager === 'npm')
  }

  return {
    managers: supportedManagers,
    async detect() {
      const file = command === 'pi' && process.env.PI_EXECUTABLE ? process.env.PI_EXECUTABLE : executable(command)
      if (!file) {
        // A GUI's inherited PATH may predate the creation of a global bin folder.
        if (command === 'pi') {
          for (const manager of await availableManagers()) {
            try {
              const installed = await managerInstallation(manager, command, packageName)
              if (installed) {
                addGlobalBin(installed.executable)
                return { installed: true, ...installed, managed: true, packageManager: manager }
              }
            } catch {
              /* Other managers may have no global installation. */
            }
          }
        }
        return { installed: false }
      }

      const real = realpathSync(file)
      const installerPackage = command === 'pi' ? resolveWindowsPiInstallerPackage(file, packageName) : undefined

      let dir = path.dirname(real)
      // npm symlinks on Unix and .cmd shims on Windows have different layouts.
      const candidates =
        command === 'pi' && process.platform === 'win32'
          ? windowsPiPackageCandidates(process.env, path.win32.dirname(file))
          : [path.join(path.dirname(file), 'node_modules', packageName, 'package.json')]

      for (let i = 0; i < 5; i++) {
        candidates.push(path.join(dir, 'package.json'))
        dir = path.dirname(dir)
      }

      for (const candidate of candidates) {
        if (!existsSync(candidate)) continue
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'))
        if (pkg.name === packageName && typeof pkg.version === 'string') {
          if (
            installerPackage &&
            path.win32.normalize(candidate).toLowerCase() === path.win32.normalize(installerPackage).toLowerCase()
          ) {
            return {
              installed: true,
              installedVersion: pkg.version,
              executable: file,
              managed: false,
              installationKind: 'pi-windows-installer'
            }
          }
          const owner = await installationOwner(file, packageName, await supportedManagers())
          return {
            installed: true,
            installedVersion: pkg.version,
            executable: file,
            managed: !!owner,
            packageManager: owner
          }
        }
      }

      const owner = await installationOwner(file, packageName, await supportedManagers())
      if (owner) {
        const paths = targetPath()
        const manifestPath = paths.join(await managerPackageDir(owner, packageName), 'package.json')
        const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
        if (typeof pkg.version === 'string') {
          return {
            installed: true,
            installedVersion: pkg.version,
            executable: file,
            managed: true,
            packageManager: owner
          }
        }
      }

      if (command === 'opencode' || isManagerPluginCommand(command)) {
        const cli = command === 'opencode' ? { file, args: [] } : managerCommand(command)
        const output = (await run(cli.file, [...cli.args, '--version'], 5000)).trim()
        const version = command === 'opencode' ? parseOpenCodeVersion(output) : output
        if (/^\d+\.\d+\.\d+$/.test(version)) {
          return { installed: true, installedVersion: version, executable: file, managed: false }
        }
      }

      throw new Error(
        `${command} exists at ${file}, but its package version could not be verified. Manage this installation manually.`
      )
    },
    async verify(manager, version) {
      if (command !== 'pi') return
      const installed = await managerInstallation(manager, command, packageName)
      if (!installed || installed.installedVersion !== version) {
        throw new Error(`Cannot verify ${packageName}@${version} in ${manager}'s global installation.`)
      }
      const current = process.env.PI_EXECUTABLE || executable(command)
      if (current && normalizeTargetPath(realpathSync(current)) !== normalizeTargetPath(realpathSync(installed.executable))) {
        throw new Error(
          `${manager} installed ${packageName}@${version} at ${installed.executable}, but ${current} shadows it on PATH (or PI_EXECUTABLE). Remove the conflict or select the intended Pi executable, then restart Shumora. No files were removed.`
        )
      }
      addGlobalBin(installed.executable)
    },
    async catalog() {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
        signal: AbortSignal.timeout(15_000)
      })
      if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`)
      const pkg = (await response.json()) as { version?: string }
      if (!pkg.version || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
        throw new Error('Registry did not return a stable version')
      }

      let changelog = 'No matching release notes were found for this npm version.'
      const release = await fetch(`https://api.github.com/repos/${repository}/releases/tags/v${pkg.version}`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15_000)
      })
      if (release.ok) {
        const data = (await release.json()) as { body?: string }
        changelog = data.body?.slice(0, 100_000) || changelog
      }
      return { latestVersion: pkg.version, changelog }
    },
    async run(args, output, manager = 'npm') {
      if (isManagerPluginCommand(command) && manager !== 'npm') {
        throw new Error('Package manager plugins are managed only through a verified npm installation.')
      }
      const npm = managerCommand(manager)
      const current = command === 'pi' && process.env.PI_EXECUTABLE ? process.env.PI_EXECUTABLE : executable(command)
      if (current) {
        const owner = await installationOwner(current, packageName, [manager])
        if (owner !== manager) {
          throw new Error(
            `The ${command} installation is not owned by the active ${manager} global installation. Manage it manually to avoid changing another installation.`
          )
        }
      }
      // Only log once ownership verification has passed.
      output?.(`$ ${manager} ${args.join(' ')}\n`)
      // Fixed argv only, no shell, sudo, password prompting or arbitrary package names.
      const timeout = installTimeout()
      output?.(`[Shumora] Executable: ${npm.file}; install timeout: ${timeout} ms\n`)
      await run(npm.file, [...npm.args, ...args], timeout, output)
    }
  }
}
