export async function fetchPackagePage(input: string): Promise<string> {
  let url = new URL(input)
  const signal = AbortSignal.timeout(20000)
  for (let attempt = 0; attempt < 5; attempt++) {
    if (url.origin !== 'https://pi.dev' || url.username || url.password) throw new Error('Pi gallery redirect changed origin')
    const response = await fetch(url.toString(), { signal, redirect: 'manual' })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Pi gallery redirect has no location')
      await response.body?.cancel()
      url = new URL(location, url)
      continue
    }
    if (!response.ok) throw new Error(`Pi gallery HTTP ${response.status}`)
    const html = await response.text()
    if (html.length > 5_000_000) throw new Error('Pi gallery response too large')
    return html
  }
  throw new Error('Too many Pi gallery redirects')
}
