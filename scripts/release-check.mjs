import { readFileSync } from 'node:fs'
import { validateRelease } from './release-utils.mjs'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const notes = readFileSync(`changelogs/${pkg.version}.md`, 'utf8')
validateRelease({ version: pkg.version, lockVersion: lock.version, notes })
if (lock.packages[''].version !== pkg.version) throw new Error('Lock root package version does not match')
console.log(`Release source validated: ${pkg.version} / changelogs/${pkg.version}.md`)
