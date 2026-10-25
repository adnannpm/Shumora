import { version } from '../../../package.json'

const files = import.meta.glob('../../../changelogs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
export const releaseVersion = version
export const releaseNotes = files[`../../../changelogs/${version}.md`]
if (!releaseNotes) throw new Error(`Missing release notes for Shumora ${version}`)
