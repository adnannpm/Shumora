import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { PiPackage, PackageInstallation, PackageAction } from '../../shared/packages'
import type { PluginOperation } from '../../shared/plugins'
import { DataSkeleton } from './DataSkeleton'
import { PackagePreview } from './PackagePreview'

// Standalone top-level package detail page, matching the plugin detail shell
// (RouterDetails): back-arrow toolbar, refresh icon, persistent action footer.
// Rendered outside the Library tabs so no Library heading or tab list shows above it.
export function PackageDetails({ item, onBack }: { item: PiPackage; onBack: () => void }) {
  const { t } = useLanguage()
  const [installation, setInstallation] = useState<PackageInstallation>()
  const [checking, setChecking] = useState(false)
  const [confirm, setConfirm] = useState<PackageAction | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [operation, setOperation] = useState<PluginOperation>({ status: 'idle', output: '' })
  const [logsOpen, setLogsOpen] = useState(false)
  const ownsOperation = useRef(false)
  // Generation guard: a slow status response for a package that is no longer
  // selected must never overwrite the currently selected package's status.
  const generation = useRef(0)
  const statusRequest = useRef(0)
  const outputRef = useRef<HTMLPreElement>(null)
  const followOutput = useRef(true)
  const revealOutput = useRef(false)

  async function checkStatus(preserveError = false) {
    const current = ++statusRequest.current
    setChecking(true); setInstallation(undefined)
    try {
      const value = await window.packages.status(item.name)
      if (statusRequest.current === current) { setInstallation(value); if (!preserveError) setError('') }
    } catch {
      if (statusRequest.current === current) setError('Cannot verify the personal Pi package installation. Check Pi settings and try again.')
    } finally {
      if (statusRequest.current === current) setChecking(false)
    }
  }
  useEffect(() => {
    generation.current++
    ownsOperation.current = false
    setOperation({ status: 'idle', output: '' }); setError(''); setConfirm(null); setNotice('')
    void checkStatus()
    return () => { generation.current++; statusRequest.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.name])
  useEffect(() => { if (operation.status !== 'idle') setLogsOpen(true) }, [operation.status])
  useEffect(() => {
    let alive = true
    const off = window.packages?.onOperation(value => { if (alive && ownsOperation.current) setOperation(value) })
    return () => { alive = false; off?.() }
  }, [])

  useEffect(() => {
    if (logsOpen && followOutput.current && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [operation.output, logsOpen])
  function revealInstallationOutput() {
    if (!revealOutput.current) return
    revealOutput.current = false
    requestAnimationFrame(() => outputRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }))
  }
  async function copyLog() {
    try { await navigator.clipboard.writeText(operation.output); setNotice('Output copied') }
    catch { setNotice('Could not copy output') }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`pi install npm:${item.name}@${item.version}`); setNotice('Install command copied') }
    catch { setNotice('Could not copy command') }
  }
  async function install() {
    if (!confirm || operation.status === 'running') return
    const action = confirm
    const current = generation.current
    ownsOperation.current = true
    revealOutput.current = true
    setLogsOpen(true)
    followOutput.current = true
    setConfirm(null); setError(''); setOperation({ status: 'running', output: 'Starting Pi package installation…\n' })
    try {
      const result = await window.packages.mutate(action, item.name, action === 'uninstall' ? undefined : item.version)
      if (generation.current === current) setOperation(result)
    } catch {
      if (generation.current !== current) return
      setOperation(previous => ({ ...previous, status: 'failed' }))
      setError('Package operation failed. Check the output below. Sessions stopped for this operation remain stopped unless they were already restarted. You can restart them manually after resolving the error.')
    } finally {
      if (generation.current === current) await checkStatus(true)
    }
  }
  const running = operation.status === 'running'
  return <main className="settings-page flex min-w-0 flex-1 flex-col">
    <header className="toolbar router-toolbar">
      <div className="router-heading">
        <Button size="sm" variant="ghost" aria-label={t("Back to packages")} title={t("Back to packages")} onClick={onBack}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg></Button>
        <h1>{item.name}</h1>
      </div>
      <Button size="sm" variant="ghost" aria-label={t("Refresh installation status")} title={t("Refresh installation status")} disabled={checking || running} onClick={() => void checkStatus()}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17" /></svg></Button>
    </header>
    <div className="router-details">
      <h2>{item.name}</h2>
      <p>{item.description || t("No description provided.")}</p>
      <p className="plugin-attribution">{item.author || t("Unknown author")} · {item.version || t("Version unavailable")} · {item.types.join(', ') || t("package")}</p>
      <p className="package-sources">
        <a href={`https://pi.dev/packages/${item.name}`} target="_blank" rel="noopener noreferrer">{t("pi.dev")}</a>
        <a href={`https://www.npmjs.com/package/${item.name}`} target="_blank" rel="noopener noreferrer">{t("npm")}</a>
        {item.repository && <a href={item.repository} target="_blank" rel="noopener noreferrer">{t("Repository")}</a>}
      </p>
      <PackagePreview key={`${item.name}-${item.thumbnail || ''}`} item={item} variant="detail" />
      {notice && <p role="status">{t(notice)}</p>}
      {error && <p className="plugin-error" role="alert">{t(error)}</p>}
      <p className="settings-note">{t("Pi scope: this adds the package to your personal Pi configuration, not the system npm global installation. Restart your Pi sessions to load it. Packages are third-party code; a gallery listing is not a security endorsement.")}</p>
      <section className="plugin-output" aria-label={t("Package installation output")}>
        <div className="plugin-output-header"><strong>{t("Package Installation Output")}</strong><span className={`plugin-output-status ${operation.status}`} role="status">{{ idle: t("Ready"), running: t("Running"), success: t("Success"), failed: t("Failed") }[operation.status]}</span><Button size="xs" variant="ghost" disabled={!operation.output} onClick={() => void copyLog()}>{t("Copy log")}</Button><Button size="xs" variant="ghost" aria-expanded={logsOpen} onClick={() => setLogsOpen(value => !value)}>{logsOpen ? t("Hide output") : t("Show output")}</Button></div>
        <div className="plugin-output-body" hidden={!logsOpen}>
          <pre ref={outputRef} className="plugin-output-log" role="log" tabIndex={0} onScroll={event => { const el = event.currentTarget; followOutput.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24 }}>{operation.output || t("No package operation yet.")}</pre>
        </div>
      </section>
    </div>
    <footer className="plugin-detail-footer" aria-label={t("Package actions")}>
      <span className="plugin-action-status" role="status">{checking ? t("Checking installation…") : installation?.installed ? t("Installed · {version} · Personal Pi scope", { version: installation.installedVersion || "" }) : installation?.configured ? t("Configured · installation missing · Personal Pi scope") : installation ? t("Not installed · Personal Pi scope") : t("Loading installation status…")}</span>
      <div className="plugin-footer-buttons">
        <Button variant="outline" disabled={checking || running} onClick={() => void checkStatus()}>{t("Refresh installation")}</Button>
        <Button variant="outline" disabled={!item.version} onClick={() => void copy()}>{t("Copy install command")}</Button>
        {checking ? <DataSkeleton label={t("Checking package installation")} shape="button" /> : installation && <>
          {installation.configured && <Button variant="outline" colorPalette="red" disabled={running} onClick={() => setConfirm('uninstall')}>{t("Uninstall")}</Button>}
          {!installation.configured
            ? <Button className="library-primary-action" colorPalette="brand" disabled={!item.version || running} onClick={() => setConfirm('install')}>{t("Install for Pi")}</Button>
            : <Button className="library-primary-action" colorPalette="brand" disabled={!item.version || running || installation.installedVersion === item.version} onClick={() => setConfirm('update')}>{installation.installed ? t("Update") : t("Repair installation")}</Button>}
        </>}
      </div>
    </footer>
    <Dialog.Root onExitComplete={revealInstallationOutput} open={confirm !== null} role="alertdialog" placement="center" onOpenChange={({ open }) => { if (!open) setConfirm(null) }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="library-dialog">
        <Dialog.Header><Dialog.Title>{confirm === 'uninstall' ? t("Uninstall") : confirm === 'update' ? t("Update") : t("Install")} {item.name}?</Dialog.Title></Dialog.Header>
        <Dialog.Body>{confirm === 'uninstall' ? t("This removes the package from your personal Pi configuration and managed installation.") : t("This installs version {version} for your Pi sessions.", { version: item.version })} {t("Third-party extensions can execute code and access files with your user permissions. Review and trust the package before continuing.")}<p className="settings-note">{t("All running Workspace sessions will be stopped, including hidden terminals. Save your work first. After a successful package change, only those sessions will restart as new Pi processes. Agent work and previous conversations will not resume automatically. If the package change fails, sessions remain stopped.")}</p></Dialog.Body>
        <Dialog.Footer><Button variant="outline" onClick={() => setConfirm(null)}>{t("Cancel")}</Button><Button className={confirm === 'uninstall' ? "library-danger-action" : "library-primary-action"} colorPalette={confirm === 'uninstall' ? "red" : "brand"} onClick={() => void install()}>{confirm === 'update' ? t("Stop sessions and update") : <>{t("Confirm")} {t(confirm === 'uninstall' ? 'uninstall' : 'install')}</>}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </main>
}
