// Probe only the default local 9router endpoint; never follow redirects or send credentials.
export async function routerHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:20128/api/health', { signal: AbortSignal.timeout(3000), redirect: 'error', cache: 'no-store' })
    if (!response.ok) return false
    const body = await response.json() as { ok?: boolean }
    return body.ok === true
  } catch { return false }
}
