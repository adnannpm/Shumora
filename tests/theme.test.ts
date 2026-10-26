import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { terminalTheme } from '../src/renderer/src/theme'
it('uses a readable dark terminal palette with all ANSI colors defined', () => {
  expect(terminalTheme.background).toBe('#10151e')
  expect(terminalTheme.foreground).toBe('#d2d9e5')
  for (const color of ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite']) {
    expect(terminalTheme[color as keyof typeof terminalTheme]).toMatch(/^#[0-9a-f]{6}$/)
  }
})
it('hides only xterm scrollbar chrome without disabling terminal scrolling', () => {
  const css = readFileSync('src/renderer/src/style.css', 'utf8')
  expect(css).toContain('.terminal-host .xterm .xterm-scrollable-element > .scrollbar')
  expect(css).toContain('visibility: hidden')
  expect(css).toContain('scrollbar-width: none')
})
it('uses application theme colors for 9router button and tab hover states', () => {
  const css = readFileSync('src/renderer/src/style.css', 'utf8')
  expect(css).toContain('.router-dashboard button:hover:not(:disabled)')
  expect(css).toContain('.router-dashboard button[data-selected]')
  const hover = css.match(/\.router-dashboard button:hover:not\(:disabled\)\s*\{([^}]+)\}/)?.[1]
  expect(hover).toContain('background: var(--selected)')
  expect(hover).toContain('color: var(--selected-text)')
})
it('fills the service logs panel and wraps long output without horizontal scrolling', () => {
  const css = readFileSync('src/renderer/src/style.css', 'utf8')
  expect(css).toContain('.router-dashboard .router-logs-panel[data-state=open]')
  const log = css.match(/\.router-logs-panel \.plugin-output-log\s*\{([^}]+)\}/)?.[1]
  expect(log).toContain('flex: 1')
  expect(log).toContain('height: auto')
  expect(log).toContain('overflow-x: hidden')
  expect(log).toContain('white-space: pre-wrap')
})
it('defaults the desktop and renderer to light mode with Shumora branding', () => {
  expect(readFileSync('src/renderer/src/style.css', 'utf8')).toContain('color-scheme: light')
  expect(readFileSync('src/main/index.ts', 'utf8')).toContain("backgroundColor: '#ffffff'")
  expect(readFileSync('src/renderer/index.html', 'utf8')).toContain('<title>Shumora</title>')
})
