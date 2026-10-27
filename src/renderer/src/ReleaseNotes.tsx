import { useLanguage } from './Language'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import Markdown from 'react-markdown'
import { releaseNotes, releaseVersion } from './release-data'
const ReleaseContext = createContext({ show: () => {} })
export const useReleaseNotes = () => useContext(ReleaseContext)
export function ReleaseNotesProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
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
        <Dialog.Header><Dialog.Title>{t("What’s new in Shumora")} {releaseVersion}</Dialog.Title></Dialog.Header>
        <Dialog.Body><div className="release-notes" data-testid="release-notes"><Markdown skipHtml components={{
          h1: ({ children }) => <h2>{children}</h2>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          a: ({ children, href }) => <span className="release-link">{children}{href ? ` (${href})` : ''}</span>,
          img: ({ alt }) => <span>{alt}</span>
        }}>{releaseNotes}</Markdown></div></Dialog.Body>
        <Dialog.Footer><Button colorPalette="brand" onClick={dismiss}>{t("Got it")}</Button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
  </ReleaseContext.Provider>
}
