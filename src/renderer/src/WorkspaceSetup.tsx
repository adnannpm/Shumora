import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
type PluginId = 'pi' | '9router'
export function WorkspaceSetup({ active, onSetup }: { active: boolean; onSetup: (id: PluginId) => void }) {
  const checked = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [missing, setMissing] = useState<PluginId[]>([])
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (!active || checked.current) return
    checked.current = true
    void Promise.allSettled([
      window.piPlugin?.status(), window.plugins?.status()
    ]).then(results => {
      if (!alive.current) return
      setMissing(results.flatMap((result, i) => result.status === 'fulfilled' && result.value?.installed === false && !result.value.error ? [i === 0 ? 'pi' as const : '9router' as const] : []))
    })
  }, [active])
  return <Dialog.Root open={active && !dismissed && missing.length > 0} placement="center" size="md" onOpenChange={({ open }) => { if (!open) setDismissed(true) }}><Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
    <Dialog.Header><Dialog.Title>Set up your Terminals</Dialog.Title></Dialog.Header>
    <Dialog.Body><Dialog.Description>These tools were not found on your computer. Open a plugin to review and confirm its installation.</Dialog.Description>
      {missing.map(id => <section className="workspace-setup-item" key={id}><div><strong>{id === 'pi' ? 'Pi' : '9router'}</strong><p>{id === 'pi' ? 'Required to run coding agent sessions in Workspace.' : 'Optional AI gateway for provider and model routing.'}</p><small>Not installed</small></div><Button variant="outline" onClick={() => { setDismissed(true); onSetup(id) }}>Set up {id === 'pi' ? 'Pi' : '9router'}</Button></section>)}
    </Dialog.Body><Dialog.Footer><Button variant="outline" onClick={() => setDismissed(true)}>Later</Button></Dialog.Footer>
  </Dialog.Content></Dialog.Positioner></Portal></Dialog.Root>
}
