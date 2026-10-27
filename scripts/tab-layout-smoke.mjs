import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'

// Real Chromium layout checks: jsdom does not calculate flex widths.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true })
try {
  const page = await browser.newPage()
  const css = await readFile(new URL('../src/renderer/src/style.css', import.meta.url), 'utf8')
  await page.setContent('<style></style><div id="fixture"></div>')
  await page.locator('style').evaluate((el, css) => { el.textContent = css }, css)
  for (const [width, count, editing] of [[1000, 2, false], [1000, 13, false], [420, 13, false], [420, 13, true]]) {
    await page.locator('#fixture').evaluate((el, { width, count, editing }) => {
      el.innerHTML = `<div class="tab-group-bar" style="width:${width}px;height:42px"><div class="session-tablist">${Array.from({ length: count }, (_, i) => `<div class="session-tab">${editing && i === 0 ? '<input class="tab-rename-input" value="Rename this terminal">' : '<button role="tab"><span class="status-dot"></span><span class="session-tab-name">Very long terminal name backend server</span></button>'}<button class="close-tab">×</button></div>`).join('')}</div><button style="flex-shrink:0;width:32px">+</button></div>`
    }, { width, count, editing })
    const sizes = await page.evaluate(() => {
      const list = document.querySelector('.session-tablist')
      const tabs = [...document.querySelectorAll('.session-tab')]
      return { list: list.clientWidth, scroll: list.scrollWidth, widths: tabs.map(tab => tab.getBoundingClientRect().width), end: tabs.at(-1).getBoundingClientRect().right, edge: list.getBoundingClientRect().right }
    })
    assert(sizes.scroll <= sizes.list + 1, `${count} tabs at ${width}px overflow horizontally`)
    assert(Math.abs(sizes.widths.reduce((a, b) => a + b, 0) - sizes.list) <= 2, 'Tabs must fill the available width')
    assert(Math.max(...sizes.widths) - Math.min(...sizes.widths) < 1, 'Tabs must share width equally')
    assert(sizes.end <= sizes.edge + 1, 'Last tab must stay visible')
  }
  console.log('PASS: tabs fill available width, shrink equally for 13 sessions, and fit narrow groups while renaming.')
} finally {
  await browser.close()
}
