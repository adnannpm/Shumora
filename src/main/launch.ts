import { existsSync } from 'node:fs'
import path from 'node:path'

export function resolveLaunch(platform: string, env: NodeJS.ProcessEnv, searchPath: string, exists: (path: string) => boolean = existsSync): { file: string; args: string[] } {
  const windows = platform === 'win32'
  const paths = windows ? path.win32 : path.posix
  const dirs = searchPath.split(windows ? ';' : ':').filter(Boolean)
  const names = windows ? ['pi.exe', 'pi.cmd', 'pi.bat', 'pi'] : ['pi']
  const file = env.PI_EXECUTABLE || dirs.flatMap((dir) => names.map((name) => paths.join(dir, name))).find(exists)
  if (!file) throw new Error('Pi executable not found. Install Pi and ensure it is on PATH, or set PI_EXECUTABLE before starting this app.')
  if (!windows || /\.exe$/i.test(file)) return { file, args: [] }
  // npm installs expose a .cmd shim. Run its known package entry with real Node;
  // never feed executable paths or renderer input through cmd.exe evaluation.
  const cli = env.PI_CLI_PATH || paths.join(paths.dirname(file), 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'cli.js')
  const node = env.PI_NODE_EXECUTABLE || [paths.join(paths.dirname(file), 'node.exe'), ...dirs.map((dir) => paths.join(dir, 'node.exe'))].find(exists)
  if (!node || !exists(cli)) throw new Error('Cannot resolve Windows Pi launcher. Set PI_NODE_EXECUTABLE to node.exe and PI_CLI_PATH to Pi dist/cli.js, or PI_EXECUTABLE to a native Pi .exe.')
  return { file: node, args: [cli] }
}
