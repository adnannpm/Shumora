import { join } from 'node:path'

// Pi is an external Node process and cannot read Electron's ASAR filesystem.
export function meetingExtensionPath(packaged: boolean, resourcesPath: string, mainDir: string) {
  return packaged
    ? join(resourcesPath, 'meeting-extension.mjs')
    : join(mainDir, '../../resources/meeting-extension.mjs')
}
