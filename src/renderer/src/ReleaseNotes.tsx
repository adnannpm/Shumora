import { createContext, useContext, useState, type ReactNode } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import { releaseNotes, releaseVersion } from './release-data'
const ReleaseContext = createContext({ show: () => {} })
export const useReleaseNotes = () => useContext(ReleaseContext)
export function ReleaseNotesProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem('shumora.seenRelease') !== releaseVersion } catch { return true }
  })
  function dismiss() {
    setOpen(false)
    try { window.localStorage.setItem('shumora.seenRelease', releaseVersion) } catch { /* Reopen on next launch if storage is unavailable. */ }
  }
  return <ReleaseContext.Provider value={{ show: () => setOpen(true) }}>
    {children}
    <Dialog.Root open={open} onOpenChange={({ open }) => { if (!open) dismiss() }} placement="center" size="lg" scrollBehavior="inside" closeOnInteractOutside={false}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
        <Dialog.Header><Dialog.Title>What’s new in Shumora {releaseVersion}</Dialog.Title></Dialog.Header>
        <Dialog.Body><pre className="release-notes" data-testid="release-notes">{releaseNotes}</pre></Dialog.Body>
        <Dialog.Footer><Button colorPalette="brand" onClick={dismiss}>Got it</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </ReleaseContext.Provider>
}
