import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseVersion } from './release-utils.mjs'
const version = process.argv[2]
const next = parseVersion(version)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const current = parseVersion(pkg.version)
const firstDifference = next.findIndex((part, i) => part !== current[i])
if (firstDifference < 0 || next[firstDifference] < current[firstDifference]) throw new Error('New version must be higher than the current version')
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Commit or stash changes before preparing a release')
const file = `changelogs/${version}.md`
if (existsSync(file)) throw new Error(`Release notes already exist: ${file}`)
// Write matching package metadata without lifecycle scripts, commits or tags.
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw new Error('Fix package/lock version mismatch first')
pkg.version = version; lock.version = version; lock.packages[''].version = version
mkdirSync('changelogs', { recursive: true })
writeFileSync(file, `# Shumora ${version}\n\n## Changes\n\n- TODO: Describe the changes users will receive.\n`)
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n')
console.log(`Prepared ${version}. Edit ${file}, run npm run release:check, then submit a PR. No build, tag or publication was triggered.`)
