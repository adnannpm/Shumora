import { useLanguage } from './Language'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { PackageManager, PluginMetadata } from '../../shared/plugins'
type PluginId = 'opencode' | 'pi' | '9router' | 'node' | 'pnpm' | 'bun' | 'yarn'
type AgentId = 'pi' | 'opencode' | '9router'
type Tool = { installed: boolean; version?: string; error?: string; latest?: string }
const managers: PackageManager[] = ['npm', 'pnpm', 'bun', 'yarn']
export function WorkspaceSetup({ active, onSetup, onContinue, onCancel, startupOnly = false }: { active: boolean; onSetup: (id: PluginId) => void; onContinue?: () => Promise<void>; onCancel?: () => void; startupOnly?: boolean }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [startupVisible, setStartupVisible] = useState(false)
  const [tools, setTools] = useState<Partial<Record<AgentId, Tool>>>({})
  const [available, setAvailable] = useState<PackageManager[]>([])
  const [harness, setHarness] = useState<'pi' | 'opencode'>('pi')
  const [manager, setManager] = useState<PackageManager>('npm')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const operation = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const steps = ['Package manager', 'Harness', '9router', 'Done']
  const titles = ['Prepare your installation tools', 'Choose your harness', 'Add 9router', 'Ready to code']
  function update(id: AgentId, value: Pick<PluginMetadata<'pi' | '9router'>, 'installed' | 'installedVersion' | 'latestVersion' | 'error'>) {
    setTools(current => ({ ...current, [id]: { installed: value.installed, version: value.installedVersion, latest: value.latestVersion, error: value.error } }))
    if (id === 'pi' && !value.installed && !value.error) setStartupVisible(true)
  }
  useEffect(() => {
    if (!active || dismissed) return
    const request = ++generation.current
    function check() {
      for (const id of ['pi', 'opencode', '9router'] as const) {
        const api = id === 'pi' ? window.piPlugin : id === 'opencode' ? window.opencodePlugin : window.plugins
        if (!api) { setTools(current => ({ ...current, [id]: { installed: false, error: t('Restart Shumora to load the plugin bridge.') } })); continue }
        void api.status(true).then(value => {
          if (request !== generation.current || operation.current) return
          update(id, value)
          if (id === 'pi') {
            const supported = value.availableManagers || []
            setAvailable(supported)
            setManager(current => supported.includes(current) ? current : supported[0] || 'npm')
          }
        }).catch(e => { if (request === generation.current) setTools(current => ({ ...current, [id]: { installed: false, error: String(e) } })) })
      }
    }
    check()
    window.addEventListener('focus', check)
    return () => { generation.current++; window.removeEventListener('focus', check) }
  }, [active, dismissed])
  useEffect(() => { if (active) heading.current?.focus() }, [step, active])
  function cancel() { if (operation.current) return; setDismissed(true); onCancel?.() }
  function setup(id: PluginId) { onSetup(id) }
  async function finish() {
    if (operation.current || (!tools[harness]?.installed || tools[harness]?.error)) return
    operation.current = true; setBusy(true); setError('')
    try { await onContinue?.(); setDismissed(true) }
    catch (e) { setError(String(e)) } finally { operation.current = false; setBusy(false) }
  }
  const toolId = '9router'
  const harnessName = harness === 'pi' ? 'Pi' : 'OpenCode'
  const tool = tools[toolId]
  const ready = step === 0 ? available.includes(manager) : step === 1 ? !!tools[harness]?.installed && !tools[harness]?.error : true
  return <Dialog.Root open={active && !dismissed && (!startupOnly || startupVisible)} placement="center" size="lg" closeOnInteractOutside={!busy && step < 3} closeOnEscape={!busy} onOpenChange={({ open }) => { if (!open) cancel() }}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="terminal-setup-dialog">
    <Dialog.Header className="terminal-setup-header"><div><Dialog.Title>{t('Set up your Terminals')}</Dialog.Title><Dialog.Description>{t('A few essentials before your first coding session.')}</Dialog.Description></div>{step < 3 && <Button size="sm" variant="ghost" aria-label={t('Close setup')} disabled={busy} onClick={cancel}>×</Button>}</Dialog.Header>
    <Dialog.Body>
      <ol className="terminal-setup-steps" aria-label={t('Terminal setup steps')}>{steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} data-complete={index < step}><button type="button" aria-label={t('Step {number}: {label}', { number: index + 1, label: t(label) })} disabled={busy || index >= step} onClick={() => { setStep(index); setError('') }}><span aria-hidden="true">{index < step ? '✓' : index + 1}</span>{t(label)}</button></li>)}</ol>
      <section className={step === 3 ? 'terminal-setup-step terminal-setup-finish' : 'terminal-setup-step'} aria-labelledby="terminal-setup-heading">
        <h2 ref={heading} tabIndex={-1} id="terminal-setup-heading">{t(titles[step])}</h2>
        {step === 0 && <><p>{t('Choose one package manager to install your coding tools.')}</p>
          <div className="terminal-setup-managers" role="radiogroup" aria-label={t('Package manager')}>{managers.map(id => <div key={id} data-selected={available.includes(id) && id === manager}><label><input type="radio" name="setup-manager" value={id} checked={available.includes(id) && manager === id} disabled={!available.includes(id)} onChange={() => setManager(id)} /><strong>{id === 'bun' ? 'Bun' : id === 'yarn' ? 'Yarn' : id}</strong><small>{t(!tools.pi ? 'Checking…' : available.includes(id) ? 'Available' : tools.pi.error ? 'Unverified' : 'Not installed')}</small></label>{tools.pi && !available.includes(id) && <Button size="xs" variant="ghost" onClick={() => setup(id === 'npm' ? 'node' : id)}>{t('Set up')} {id === 'npm' ? 'Node.js' : id === 'bun' ? 'Bun' : id === 'yarn' ? 'Yarn' : id}<span aria-hidden="true"> ↗</span></Button>}</div>)}</div>
          <p className="terminal-setup-hint">{t('You only need one. If you do not have one yet, start with Node.js — npm is included.')}</p></>}
        {step === 1 && <><p>{t('Choose the coding harness you want to set up. You only need one to continue.')}</p>
          <div className="terminal-setup-managers terminal-setup-harnesses" role="radiogroup" aria-label={t('Harness')}>{(['pi', 'opencode'] as const).map(id => {
            const value = tools[id]
            const name = id === 'pi' ? 'Pi' : 'OpenCode'
            return <div key={id} data-selected={harness === id}><label><input type="radio" name="setup-harness" checked={harness === id} onChange={() => setHarness(id)} /><strong>{name}</strong><small>{!value ? t('Checking…') : value.error ? t('Unverified') : value.installed ? t('Installed · {version}', { version: value.version || t('Unknown version') }) : t('Not installed')}</small></label><Button size="xs" variant="ghost" onClick={() => setup(id)}>{t(value?.installed ? 'Details' : 'Set up')} {name}<span aria-hidden="true"> ↗</span></Button></div>
          })}</div>
          {tools[harness]?.error && <p className="plugin-error" role="alert">{tools[harness]?.error}</p>}
          <p className="terminal-setup-hint">{t(tools[harness]?.installed && !tools[harness]?.error ? 'Your selected harness is installed. You can continue.' : 'Install it from the plugin page, then return here to continue.')}</p>
        </>}
        {step === 2 && <><span className="terminal-setup-optional">{t('Optional')}</span><p>{t('9router is an optional gateway for connecting coding tools to AI providers.')}</p>
          <div className="terminal-setup-tool-status" role="status" data-ready={!!tool?.installed && !tool.error}><span aria-hidden="true">{tool?.installed && !tool.error ? '✓' : '•'}</span>{!tool ? t('Checking…') : tool.error ? t('Could not verify installation.') : tool.installed ? t('Installed · {version}', { version: tool.version || t('Unknown version') }) : t('9router is not installed yet.')}</div>
          {tool && (!tool.installed || tool.error) && <Button variant="outline" onClick={() => setup(toolId)}>{t('Open 9router plugin')}<span aria-hidden="true"> ↗</span></Button>}
          {tool?.error && <p className="plugin-error" role="alert">{tool.error}</p>}
          <p className="terminal-setup-hint">{t(tool?.installed && !tool.error ? '9router is installed. Configure providers from the plugin page when needed.' : 'This is not required to finish setup. You can add it later from Plugins.')}</p>
        </>}
        {step === 3 && <>
          <p>{t('Your essential tools are in place. Here is your setup:')}</p>
          <dl className="terminal-setup-summary">
            <div><dt>{t('Package manager')}</dt><dd>{manager === 'bun' ? 'Bun' : manager === 'yarn' ? 'Yarn' : manager}</dd></div>
            <div><dt>{harnessName}</dt><dd>{t('Installed · {version}', { version: tools[harness]?.version || t('Unknown version') })}</dd></div>
            <div><dt>9router <span>{t('Optional')}</span></dt><dd>{t(tools['9router']?.installed ? 'Installed' : 'Not installed')}</dd></div>
          </dl>
          <h3>{t('What comes next?')}</h3>
          <p>{t('Go to Terminals, create a session, and launch your installed harness from your project folder.')}</p>
          <p className="terminal-setup-hint">{t(tools['9router']?.installed ? '9router is installed. Configure providers from the plugin page when needed.' : 'You can add 9router later from Plugins. It does not block your first session.')}</p>
        </>}
      </section>{error && <p className="plugin-error" role="alert">{error}</p>}
    </Dialog.Body><Dialog.Footer className="terminal-setup-footer">{step < 3 && <Button variant="ghost" disabled={busy} onClick={cancel}>{t(startupOnly ? 'Later' : 'Cancel')}</Button>}<div className="terminal-setup-navigation">{step > 0 && step < 3 && <Button variant="outline" disabled={busy} onClick={() => { setStep(value => value - 1); setError('') }}>{t('Back')}</Button>}{step < 3 ? <Button className="terminal-setup-primary" colorPalette="brand" disabled={busy || !ready} onClick={() => { setStep(value => value + 1); setError('') }}>{t(step === 2 && !tools['9router']?.installed ? 'Skip for now' : 'Next')}</Button> : <Button className="terminal-setup-primary" colorPalette="brand" loading={busy} disabled={busy} onClick={() => void finish()}>{t('Go to Terminals')}</Button>}</div></Dialog.Footer>
  </Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
}
