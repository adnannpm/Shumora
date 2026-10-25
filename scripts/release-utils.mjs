export function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('Use a stable version such as 0.2.0 (no v prefix).')
  const parts = value.split('.').map(Number)
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version exceeds safe integer range')
  return parts
}
export function validateRelease({ version, lockVersion, notes }) {
  parseVersion(version)
  if (version !== lockVersion) throw new Error('Package and lock versions must match')
  const content = notes.replace(/^#+.*$/gm, '').trim()
  if (!content || /\b(?:TODO|TBD)\b|\[ \]/i.test(notes)) throw new Error('Finish the release notes before building: no empty notes, TODOs or unchecked items.')
  return notes
}
