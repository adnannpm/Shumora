import type { PackageManager } from '../shared/plugins'

export const packageManagerNames: PackageManager[] = ['npm', 'pnpm', 'bun', 'yarn']
export function globalPackageArgs(manager: PackageManager, remove: boolean, name: string): string[] {
  if (manager === 'npm') return remove ? ['uninstall', '--global', '--ignore-scripts', name] : ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', name]
  if (manager === 'pnpm') return [remove ? 'remove' : 'add', '--global', '--ignore-scripts', name]
  if (manager === 'bun') return [remove ? 'remove' : 'add', '--global', '--ignore-scripts', name]
  return ['global', remove ? 'remove' : 'add', '--ignore-scripts', '--non-interactive', name]
}
export function managerRootArgs(manager: PackageManager): string[] {
  return manager === 'yarn' ? ['global', 'dir'] : manager === 'bun' ? ['pm', 'bin', '--global'] : ['root', '--global']
}
