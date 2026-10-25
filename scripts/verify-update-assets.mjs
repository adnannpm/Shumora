import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import { parse } from 'yaml'
const [dir, version] = process.argv.slice(2)
for (const name of ['latest.yml', 'latest-linux.yml']) {
  const data = parse(readFileSync(join(dir, name), 'utf8'))
  if (data.releaseNotes !== readFileSync(`changelogs/${version}.md`, 'utf8')) throw new Error(`Release notes mismatch: ${name}`)
  if (data.version !== version || !Array.isArray(data.files) || !data.files.length) throw new Error(`Invalid updater metadata: ${name}`)
  for (const file of data.files) {
    const url = decodeURIComponent(file.url)
    if (url !== basename(url)) throw new Error('Updater asset must be a local basename')
    const bytes = readFileSync(join(dir, url))
    if (createHash('sha512').update(bytes).digest('base64') !== file.sha512) throw new Error(`Checksum mismatch: ${url}`)
    if (file.size !== undefined && file.size !== bytes.length) throw new Error(`Size mismatch: ${url}`)
  }
  console.log(`Verified updater metadata and SHA-512: ${name}`)
}
