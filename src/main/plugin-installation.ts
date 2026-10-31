import path from 'node:path'

// Resolve quoted launcher targets, not substring matches: a similarly named
// package or an unrelated global directory must never authorize removal.
export function windowsShimTargetsPackage(file: string, shim: string, packageDir: string): boolean {
  const p = path.win32
  const root = p.resolve(packageDir).toLowerCase() + '\\'
  const expanded = shim.replace(/%dp0%|%~dp0|\$basedir/gi, p.dirname(file) + '\\')
  for (const match of expanded.matchAll(/["']([^"'\r\n]+)["']/g)) {
    const target = match[1]
    if (!p.isAbsolute(target)) continue
    if (p.resolve(target).toLowerCase().startsWith(root)) return true
  }
  return false
}

export function commandFailure(error: Error & { code?: string | number | null; signal?: string | null; killed?: boolean }, stdout: string, stderr: string): string {
  return [error.message, `Exit code: ${error.code ?? 'unknown'}; signal: ${error.signal ?? 'none'}; killed/timeout: ${error.killed ?? false}`, stdout && `stdout:\n${stdout.slice(-8000)}`, stderr && `stderr:\n${stderr.slice(-8000)}`].filter(Boolean).join('\n')
}
