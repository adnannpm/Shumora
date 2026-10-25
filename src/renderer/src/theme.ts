import type { ITheme } from '@xterm/xterm'

// Terminal colors are independent of the light application shell.
export const terminalTheme = {
  background: '#10151e', foreground: '#d2d9e5', cursor: '#a7c7ff', cursorAccent: '#10151e',
  selectionBackground: '#334b65', selectionInactiveBackground: '#29384d',
  black: '#19212e', red: '#ef8b95', green: '#8cdbad', yellow: '#eac38b',
  blue: '#8caef9', magenta: '#c6a0f6', cyan: '#7fcce5', white: '#c5cedb',
  brightBlack: '#8493a8', brightRed: '#ffa4ad', brightGreen: '#a5ecc0', brightYellow: '#f5d69e',
  brightBlue: '#adc8ff', brightMagenta: '#ddbdff', brightCyan: '#a4e4f5', brightWhite: '#f3f6fa'
} satisfies ITheme
