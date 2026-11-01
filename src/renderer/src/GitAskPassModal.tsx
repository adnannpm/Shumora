import { AppCheckbox } from './AppCheckbox'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { GitAskPassRequest } from '../../shared/types'

export function GitAskPassModal() {
  const [request, setRequest] = useState<GitAskPassRequest>()
  const [passphrase, setPassphrase] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!window.workspace?.onGitAskPass) return
    return window.workspace.onGitAskPass((req) => {
      setRequest(req)
      setPassphrase('')
      setShowPassword(false)
      setError(
        /bad passphrase|try again/i.test(req.prompt)
          ? 'Incorrect passphrase. Please try again.'
          : ''
      )
    })
  }, [])

  useEffect(() => {
    if (request) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(timer)
    }
  }, [request])

  if (!request) return null

  const handleCancel = () => {
    const current = request
    setRequest(undefined)
    if (current && window.workspace?.gitAskPassReply) {
      void window.workspace.gitAskPassReply({
        requestId: current.requestId,
        canceled: true
      })
    }
  }

  const handleSkip = () => {
    const current = request
    setRequest(undefined)
    if (current && window.workspace?.gitAskPassReply) {
      void window.workspace.gitAskPassReply({
        requestId: current.requestId,
        skip: true,
        remember
      })
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const current = request
    setRequest(undefined)
    if (current && window.workspace?.gitAskPassReply) {
      void window.workspace.gitAskPassReply({
        requestId: current.requestId,
        passphrase,
        remember
      })
    }
  }

  const label = request.isUsername ? 'Username' : 'Passphrase'
  const isBad = /bad passphrase|try again/i.test(request.prompt)

  return (
    <Dialog.Root
      open
      onOpenChange={({ open }) => {
        if (!open) handleCancel()
      }}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content className="git-askpass-dialog">
            <Dialog.Header className="git-askpass-header">
              <Dialog.Title className="git-askpass-title">
                <span className="git-askpass-icon" aria-hidden="true">🔑</span>
                {request.isUsername ? 'Git Authentication' : 'SSH Key Passphrase'}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <Button size="xs" variant="ghost" onClick={handleCancel} aria-label="Close" title="Close">
                  ✕
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <form onSubmit={handleSubmit}>
              <Dialog.Body className="git-askpass-body">
                {request.key && (
                  <div className="git-askpass-target">
                    <span className="git-askpass-target-label">Key:</span>
                    <span className="git-askpass-target-path" title={request.key}>
                      {request.key}
                    </span>
                  </div>
                )}

                <p className="git-askpass-desc">
                  {request.isUsername
                    ? `Enter credentials for ${request.key || 'remote'}:`
                    : isBad
                    ? 'The previous passphrase was incorrect. Please enter the correct passphrase:'
                    : 'This key is encrypted. Enter passphrase to unlock:'}
                </p>

                {error && (
                  <div className="git-askpass-error" role="alert">
                    {error}
                  </div>
                )}

                <div className="git-askpass-input-row">
                  <input
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    className="git-askpass-input"
                    placeholder={`Enter ${label.toLowerCase()}…`}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {!request.isUsername && (
                    <button
                      type="button"
                      className="git-askpass-eye-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                      aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" className="git-action-icon" aria-hidden="true">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="git-action-icon" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {!request.isUsername && (
                  <AppCheckbox className="git-askpass-remember" checked={remember} onCheckedChange={setRemember}>
                    Remember for this session (stored in memory)
                  </AppCheckbox>
                )}

                {!request.isUsername && (
                  <div className="git-askpass-hint">
                    💡 Jika Anda memakai kunci lain (seperti <code>id_ed25519</code>) atau tidak ingin memakai kunci ini, klik <strong>Skip Key</strong>. Jika kunci ini tanpa passphrase, langsung klik <strong>Unlock &amp; Continue</strong>.
                  </div>
                )}
              </Dialog.Body>

              <Dialog.Footer className="git-askpass-footer">
                <Button size="sm" variant="outline" type="button" onClick={handleCancel}>
                  Cancel
                </Button>
                {!request.isUsername && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={handleSkip}
                    title="Skip this key so Git tries other keys"
                  >
                    Skip Key
                  </Button>
                )}
                <Button
                  size="sm"
                  className="git-action-primary"
                  type="submit"
                >
                  Unlock & Continue
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
