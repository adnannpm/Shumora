import { expect, it } from 'vitest'
import { join } from 'node:path'
import config from '../package.json'
import { meetingExtensionPath } from '../src/main/meeting-extension-path'

it('loads the development extension from the source resources folder', () => {
  expect(meetingExtensionPath(false, '/electron/resources', '/project/out/main')).toBe(join('/project/resources/meeting-extension.mjs'))
})
it('loads the packaged extension from external resources rather than app.asar', () => {
  expect(meetingExtensionPath(true, '/app/resources', '/app/resources/app.asar/out/main')).toBe(join('/app/resources/meeting-extension.mjs'))
})
it('copies the extension outside ASAR for the external Pi process', () => {
  expect(config.build.extraResources).toContainEqual({ from: 'resources/meeting-extension.mjs', to: 'meeting-extension.mjs' })
  expect(config.build.files).not.toContain('resources/meeting-extension.mjs')
})
