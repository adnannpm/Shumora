import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { stringify } from 'yaml'
import { expect, it } from 'vitest'
it.each(['lf', 'crlf', 'changed'])('validates release notes with %s line endings/content', mode => {
  const dir = mkdtempSync(join(tmpdir(), 'shumora-assets-'))
  try {
    mkdirSync(join(dir, 'changelogs')); mkdirSync(join(dir, 'assets'))
    const notes = '# Release\n\n- Approved change\n'
    writeFileSync(join(dir, 'changelogs/0.1.0.md'), notes)
    const bytes = Buffer.from('release binary')
    writeFileSync(join(dir, 'assets/app.exe'), bytes)
    const metadata = { version: '0.1.0', releaseNotes: mode === 'crlf' ? notes.replace(/\n/g, '\r\n') : mode === 'changed' ? '# Different notes\n' : notes, files: [{ url: 'app.exe', size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64') }] }
    for (const name of ['latest.yml', 'latest-linux.yml']) writeFileSync(join(dir, 'assets', name), stringify(metadata))
    // Run the actual release verifier; resolve yaml from its original script location.
    const result = spawnSync(process.execPath, [resolve('scripts/verify-update-assets.mjs'), join(dir, 'assets'), '0.1.0'], { cwd: dir, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(mode === 'changed' ? 1 : 0)
    if (mode === 'changed') expect(result.stderr).toContain('Release notes mismatch')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
