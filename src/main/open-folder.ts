import path from 'node:path'
import { statSync } from 'node:fs'

export function openFolderArgument(args: string[], platform = process.platform, isDirectory: (folder: string) => boolean = folder => statSync(folder).isDirectory()): string | undefined {
  const index = args.indexOf('--open-folder')
  if (index < 0) return undefined
  const folder = args[index + 1]
  if (!folder || !(platform === 'win32' ? path.win32 : path.posix).isAbsolute(folder)) return undefined
  try { return isDirectory(folder) ? folder : undefined } catch { return undefined }
}
