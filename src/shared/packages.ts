import type { PluginOperation } from './plugins'
export interface PiPackage { name: string; description: string; author: string; types: string[]; downloads: number; version: string; installation?: PackageInstallation }
export interface PackageInstallation { configured: boolean; installed: boolean; installedVersion?: string; source?: string }
export type PackageAction = 'install' | 'update' | 'uninstall'
export interface PackageQuery { page?: number; search?: string; type?: string; sort?: string }
export interface PackagePage { items: PiPackage[]; page: number; pages: number }
export interface LibraryUpdate { kind: 'package' | 'plugin'; id: string; name: string; installedVersion: string; latestVersion: string }
export interface LibraryUpdates { items: LibraryUpdate[]; errors: string[] }
export interface PackageAPI {
  updates(scope?: 'package' | 'plugin'): Promise<LibraryUpdates>
  detail(name: string): Promise<PiPackage>
  status(name: string): Promise<PackageInstallation>
  mutate(action: PackageAction, name: string, version?: string): Promise<PluginOperation>
  catalog(query: PackageQuery): Promise<PackagePage>
  install(name: string, version: string): Promise<PluginOperation>
  operation(): Promise<PluginOperation>
  onOperation(callback: (operation: PluginOperation) => void): () => void
}
declare global { interface Window { packages: PackageAPI } }
