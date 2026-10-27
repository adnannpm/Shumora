import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const PKG = ['@earendil-works', 'pi-coding-agent', 'dist', 'cli.js']

// GUI-launched apps (Finder, Dock, Start Menu, desktop entries) don't inherit the
// shell PATH, so also probe the places package managers install global binaries.
function fallbackDirs(windows: boolean, env: NodeJS.ProcessEnv): string[] {
  const p = windows ? path.win32 : path.posix
  const home = (windows ? env.USERPROFILE : env.HOME) || env.HOME || env.USERPROFILE || ''
  const j = (base: string | undefined, ...rest: string[]) => (base ? [p.join(base, ...rest)] : [])
  if (windows) {
    return [
      ...j(env.APPDATA, 'npm'),
      ...j(env.LOCALAPPDATA, 'pnpm'),
      ...j(home, '.bun', 'bin'),
      ...j(env.ProgramFiles, 'nodejs'),
      ...j(env.NVM_SYMLINK),
    ]
  }
  return [
    ...j(home, '.bun', 'bin'),
    ...j(home, '.npm-global', 'bin'),
    ...j(home, '.local', 'bin'),
    ...j(home, '.volta', 'bin'),
    ...j(home, '.local', 'share', 'pnpm'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/snap/bin',
  ]
}

// Windows: places where the npm/bun/pnpm global package root may live.
function cliCandidates(env: NodeJS.ProcessEnv, shimDir: string): string[] {
  const p = path.win32
  const home = env.USERPROFILE || env.HOME || ''
  const roots = [
    p.join(shimDir, 'node_modules'),
    ...(env.APPDATA ? [p.join(env.APPDATA, 'npm', 'node_modules')] : []),
    ...(env.ProgramFiles ? [p.join(env.ProgramFiles, 'nodejs', 'node_modules')] : []),
    ...(env.NVM_SYMLINK ? [p.join(env.NVM_SYMLINK, 'node_modules')] : []),
    ...(env.LOCALAPPDATA ? [p.join(env.LOCALAPPDATA, 'pnpm', 'global', '5', 'node_modules')] : []),
    ...(home ? [p.join(home, '.bun', 'install', 'global', 'node_modules')] : []),
  ]
  return roots.map((r) => p.join(r, ...PKG))
}

function loginShellPath(env: NodeJS.ProcessEnv): string {
  try {
    const shell = env.SHELL || '/bin/sh'
    return execFileSync(shell, ['-ilc', 'printf %s "$PATH"'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

export function resolveLaunch(
  platform: string,
  env: NodeJS.ProcessEnv,
  searchPath: string,
  exists: (path: string) => boolean = existsSync,
  shellPath: (env: NodeJS.ProcessEnv) => string = loginShellPath,
): { file: string; args: string[] } {
  const windows = platform === 'win32'
  const paths = windows ? path.win32 : path.posix
  const sep = windows ? ';' : ':'
  const names = windows ? ['pi.exe', 'pi.cmd', 'pi.bat', 'pi'] : ['pi']
  const find = (dirs: string[]) => dirs.flatMap((dir) => names.map((name) => paths.join(dir, name))).find(exists)

  let dirs = [...searchPath.split(sep).filter(Boolean), ...fallbackDirs(windows, env)]
  let file = env.PI_EXECUTABLE || find(dirs)
  if (!file && !windows) {
    // Last resort: ask the user's login shell (covers nvm, asdf, custom setups).
    dirs = [...dirs, ...shellPath(env).split(sep).filter(Boolean)]
    file = find(dirs)
  }
  if (!file) throw new Error('Pi executable not found. Install Pi and ensure it is on PATH, or set PI_EXECUTABLE before starting this app.')
  if (!windows || /\.exe$/i.test(file)) return { file, args: [] }
  // npm installs expose a .cmd shim. Run its known package entry with real Node;
  // never feed executable paths or renderer input through cmd.exe evaluation.
  const shimDir = paths.dirname(file)
  const cli = env.PI_CLI_PATH || cliCandidates(env, shimDir).find(exists)
  const node = env.PI_NODE_EXECUTABLE || [paths.join(shimDir, 'node.exe'), ...dirs.map((dir) => paths.join(dir, 'node.exe'))].find(exists)
  if (!node || !cli || !exists(cli)) throw new Error('Cannot resolve Windows Pi launcher. Set PI_NODE_EXECUTABLE to node.exe and PI_CLI_PATH to Pi dist/cli.js, or PI_EXECUTABLE to a native Pi .exe.')
  return { file: node, args: [cli] }
}

// Build a PATH that also contains common global-bin dirs (and the login shell PATH
// on mac/Linux). Applied once at startup so detection, npm/node lookup and spawned
// terminals (pi needs `node` on PATH) all behave the same as in a terminal.
export function enrichedPath(
  platform: string,
  env: NodeJS.ProcessEnv,
  exists: (path: string) => boolean = existsSync,
  shellPath: (env: NodeJS.ProcessEnv) => string = loginShellPath,
): string {
  const windows = platform === 'win32'
  const sep = windows ? ';' : ':'
  const current = (env.PATH || env.Path || '').split(sep).filter(Boolean)
  const extra = [...(windows ? [] : shellPath(env).split(sep).filter(Boolean)), ...fallbackDirs(windows, env)]
  const seen = new Set(current.map((d) => (windows ? d.toLowerCase() : d)))
  const added = extra.filter((d) => {
    const key = windows ? d.toLowerCase() : d
    if (seen.has(key) || !exists(d)) return false
    seen.add(key)
    return true
  })
  return [...current, ...added].join(sep)
}
