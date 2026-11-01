import { expect, it } from 'vitest'
import { pluginFailureMessage } from '../src/renderer/src/plugin-feedback'
it('turns technical failures into actionable plain-language messages', () => {
 expect(pluginFailureMessage('Error: EACCES access denied')).toContain('permission')
 expect(pluginFailureMessage('killed/timeout: true')).toContain('too long')
 expect(pluginFailureMessage('ENOTFOUND registry.npmjs.org')).toContain('internet')
 expect(pluginFailureMessage('Stop Workspace sessions')).toContain('Stop')
 expect(pluginFailureMessage('unknown stack trace')).not.toContain('stack trace')
})
