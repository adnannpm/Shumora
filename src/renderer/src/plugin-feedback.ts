export function pluginFailureMessage(detail: string): string {
  if (/Stop.*(?:Workspace|sessions)|running sessions/i.test(detail)) return 'Stop your running terminal sessions, then try again.'
  if (/Windows installer/i.test(detail)) return 'Pi was installed using the Windows installer. Use that installer to update or remove Pi. Your conversations and settings should be kept.'
  if (/EACCES|EPERM|access denied|permission denied/i.test(detail)) return 'Shumora does not have permission to change this installation. Ask the person who installed it to update or remove it.'
  if (/ENOTFOUND|EAI_AGAIN|ECONN|fetch failed|network/i.test(detail)) return 'Could not connect to the download server. Check your internet connection and try again.'
  if (/timeout|timed out/i.test(detail) && !/killed\/timeout: false/i.test(detail)) return 'The operation took too long. Check your connection and try again.'
  if (/ownership|owns this installation|not owned|manage.*manually/i.test(detail)) return 'Shumora could not confirm how this app was installed. Use the same installer or package manager that originally installed it.'
  return 'The change could not be completed. Copy the log and send it to support so we can check what happened.'
}
