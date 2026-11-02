import type { Terminal } from '@xterm/xterm'

type ClipboardTerminal = Pick<Terminal, 'getSelection' | 'paste'>

// Keep Ctrl+C available for SIGINT unless there is selected text to copy.
export function terminalClipboardHandler(term: ClipboardTerminal, options: {
  copy: (text: string) => Promise<void>
  read: () => Promise<string>
  canPaste: () => boolean
  report: (error: unknown) => void
}) {
  return (event: KeyboardEvent): boolean => {
    if (event.altKey || event.isComposing) return true
    const command = event.metaKey && !event.ctrlKey
    const control = event.ctrlKey && !event.metaKey
    if (!command && !control) return true
    const key = event.key.toLowerCase()
    const selection = key === 'c' ? term.getSelection() : ''
    const copy = key === 'c' && (command || event.shiftKey || selection.length > 0)
    const paste = key === 'v'
    if (!copy && !paste) return true
    event.preventDefault()
    // xterm invokes the custom handler for keyup/keypress too. Act only once.
    if (event.type !== 'keydown' || event.repeat) return false
    if (copy && selection) void options.copy(selection).catch(options.report)
    if (paste && options.canPaste()) {
      void options.read().then(text => {
        if (options.canPaste()) term.paste(text)
      }).catch(options.report)
    }
    return false
  }
}
