import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Exercise the real CSS in Chromium: jsdom does not render scrollbars.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true })
try {
  const page = await browser.newPage()
  const css = await readFile(new URL('../src/renderer/src/style.css', import.meta.url), 'utf8')
  await page.setContent('<style></style><div class="settings-content" tabindex="0" style="width:260px;height:180px;overflow:auto"><div style="width:500px;height:800px">Scrollable content</div></div><div class="terminal-host"><div class="xterm"><div class="xterm-viewport"></div></div></div>')
  await page.locator('style').evaluate((el, css) => { el.textContent = css }, css)
  const colors = []
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    const styles = await page.locator('.settings-content').evaluate(el => {
      const bar = getComputedStyle(el, '::-webkit-scrollbar')
      const thumb = getComputedStyle(el, '::-webkit-scrollbar-thumb')
      return { width: bar.width, height: bar.height, color: thumb.backgroundColor, radius: thumb.borderRadius, terminal: getComputedStyle(document.querySelector('.xterm-viewport'), '::-webkit-scrollbar').width }
    })
    assert.equal(styles.width, '10px', 'vertical scrollbar should use the shared compact width')
    assert.equal(styles.height, '10px', 'horizontal scrollbar should match vertical')
    assert.notEqual(styles.color, 'rgba(0, 0, 0, 0)', 'thumb must remain visible at rest')
    assert.equal(styles.radius, '8px', 'thumb should have a rounded edge')
    assert.equal(styles.terminal, '10px', 'terminal viewport must not suppress native scrollbar chrome')
    colors.push(styles.color)
    await page.locator('.settings-content').focus()
    await page.keyboard.press('End')
    await page.waitForFunction(() => document.querySelector('.settings-content').scrollTop > 0)
    await page.locator('.settings-content').evaluate(el => { el.scrollTop = 0 })
    await page.emulateMedia({ forcedColors: 'active' })
    assert.equal(await page.locator('.settings-content').evaluate(el => getComputedStyle(el).scrollbarColor), 'auto', 'high contrast mode must use system scrollbar colors')
    await page.emulateMedia({ forcedColors: 'none' })
  }
  assert.notEqual(colors[0], colors[1], 'thumb should adapt to the application theme')
  // Use the real terminal, not a mocked viewport, to exercise wheel and drag scrolling.
  const xtermCss = await readFile(new URL('../node_modules/@xterm/xterm/css/xterm.css', import.meta.url), 'utf8')
  await page.setContent('<style></style><div class="terminal-host" style="width:640px;height:240px"></div>')
  await page.locator('style').evaluate((el, css) => { el.textContent = css }, `${xtermCss}\n${css}`)
  await page.addScriptTag({ path: new URL('../node_modules/@xterm/xterm/lib/xterm.js', import.meta.url).pathname })
  await page.evaluate(async () => {
    window.term = new window.Terminal({ cols: 60, rows: 10, scrollback: 5000 })
    window.term.open(document.querySelector('.terminal-host'))
    await new Promise(resolve => window.term.write(Array.from({ length: 150 }, (_, i) => `Line ${i}\r\n`).join(''), resolve))
  })
  const scrollbar = page.locator('.xterm-scrollable-element > .scrollbar.vertical')
  await page.locator('.xterm-screen').hover()
  await page.waitForFunction(() => {
    const el = document.querySelector('.scrollbar.vertical')
    const style = getComputedStyle(el)
    return style.visibility !== 'hidden' && style.pointerEvents !== 'none' && Number(style.opacity) > 0
  }, undefined, { timeout: 3000 })
  const bottom = await page.evaluate(() => window.term.buffer.active.viewportY)
  await page.mouse.wheel(0, -240)
  await page.waitForFunction(bottom => window.term.buffer.active.viewportY < bottom, bottom)
  await page.evaluate(() => window.term.scrollToBottom())
  await page.waitForFunction(bottom => window.term.buffer.active.viewportY === bottom, bottom)
  const slider = await scrollbar.locator('.slider').boundingBox()
  assert.ok(slider, 'terminal scrollbar slider must be present')
  await page.mouse.move(slider.x + slider.width / 2, slider.y + slider.height / 2)
  await page.mouse.down()
  await page.mouse.move(slider.x + slider.width / 2, slider.y - 100, { steps: 10 })
  await page.mouse.up()
  await page.waitForFunction(bottom => window.term.buffer.active.viewportY < bottom, bottom)
  console.log('PASS: shared scrollbars and real xterm wheel/scrollbar drag scrolling.')
} finally {
  await browser.close()
}
