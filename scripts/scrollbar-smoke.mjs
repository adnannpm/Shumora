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
    assert.equal(styles.terminal, '0px', 'native terminal scrollbar must remain hidden')
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
  console.log('PASS: shared horizontal/vertical scrollbars, light/dark tokens, keyboard scrolling, high contrast and hidden terminal scrollbar.')
} finally {
  await browser.close()
}
