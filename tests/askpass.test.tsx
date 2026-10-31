// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AskPassService } from '../src/main/askpass-service'
import { GitAskPassModal } from '../src/renderer/src/GitAskPassModal'
import { Provider } from '../src/renderer/src/Provider'
import type { GitAskPassRequest } from '../src/shared/types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AskPassService', () => {
  let tmpDir: string
  let service: AskPassService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'shumora-askpass-test-'))
    service = new AskPassService(tmpDir)
  })

  afterEach(() => {
    service.dispose()
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  })

  it('starts local server and provides environment variables', async () => {
    await service.start()
    const env = service.getEnv()
    expect(env.GIT_ASKPASS).toBeTruthy()
    expect(env.SSH_ASKPASS).toBeTruthy()
    expect(env.SSH_ASKPASS_REQUIRE).toBe('force')
    expect(env.SHUMORA_ASKPASS_PORT).toMatch(/^\d+$/)
    expect(env.SHUMORA_ASKPASS_TOKEN).toBeTruthy()
  })

  it('dispatches askpass requests and caches when remembered', async () => {
    await service.start()
    const handler = vi.fn(async (req: GitAskPassRequest) => {
      service.submitReply({ requestId: req.requestId, passphrase: 'secret-passphrase', remember: true })
      return { requestId: req.requestId }
    })
    service.setHandler(handler)

    const env = service.getEnv()
    // Make request via fetch to local askpass endpoint
    const res = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: "Enter passphrase for key '/home/user/.ssh/id_rsa': " })
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.passphrase).toBe('secret-passphrase')
    expect(handler).toHaveBeenCalledTimes(1)

    // Second request should be returned from cache without calling handler again
    const res2 = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt: "Enter passphrase for key '/home/user/.ssh/id_rsa': " })
    })

    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.passphrase).toBe('secret-passphrase')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache when prompt reports bad passphrase', async () => {
    await service.start()
    let attempt = 0
    service.setHandler(async (req: GitAskPassRequest) => {
      attempt++
      service.submitReply({
        requestId: req.requestId,
        passphrase: attempt === 1 ? 'wrong' : 'correct',
        remember: true
      })
      return { requestId: req.requestId }
    })

    const env = service.getEnv()
    // Attempt 1
    await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "Enter passphrase for key '/home/user/.ssh/id_rsa': " })
    })

    // Attempt 2 with "Bad passphrase" prompt -> cache invalidated, handler called again
    const res = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "Bad passphrase, try again for /home/user/.ssh/id_rsa: " })
    })

    const json = await res.json()
    expect(json.passphrase).toBe('correct')
    expect(attempt).toBe(2)
  })

  it('returns 403 when user cancels prompt', async () => {
    await service.start()
    service.setHandler(async (req: GitAskPassRequest) => {
      service.submitReply({ requestId: req.requestId, canceled: true })
      return { requestId: req.requestId }
    })

    const env = service.getEnv()
    const res = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "Enter passphrase for key '/home/user/.ssh/id_rsa': " })
    })

    expect(res.status).toBe(403)
  })

  it('remembers skipped keys and immediately rejects them', async () => {
    await service.start()
    const handler = vi.fn(async (req: GitAskPassRequest) => {
      service.submitReply({ requestId: req.requestId, skip: true, remember: true })
      return { requestId: req.requestId }
    })
    service.setHandler(handler)

    const env = service.getEnv()
    // First request: handler is called, marks key as skipped
    const res = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "Enter passphrase for key '/home/user/.ssh/id_rsa': " })
    })
    expect(res.status).toBe(403)
    expect(handler).toHaveBeenCalledTimes(1)

    // Second request: rejected immediately from skipped set without calling handler
    const res2 = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SHUMORA_ASKPASS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "Enter passphrase for key '/home/user/.ssh/id_rsa': " })
    })
    expect(res2.status).toBe(403)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('GitAskPassModal UI', () => {
  it('displays modal on askpass event and submits reply', async () => {
    let askPassListener: ((req: GitAskPassRequest) => void) | undefined
    const gitAskPassReply = vi.fn(async () => {})

    window.workspace = {
      onGitAskPass: (callback: (req: GitAskPassRequest) => void) => {
        askPassListener = callback
        return () => { askPassListener = undefined }
      },
      gitAskPassReply
    } as any

    render(<Provider><GitAskPassModal /></Provider>)

    // Initially not visible
    expect(screen.queryByText(/SSH Key Passphrase/)).toBeNull()

    // Trigger askpass request
    askPassListener?.({
      requestId: 'req-123',
      prompt: "Enter passphrase for key '/home/hakim/.ssh/id_rsa': ",
      key: '/home/hakim/.ssh/id_rsa'
    })

    // Now modal should be visible
    expect(await screen.findByText('SSH Key Passphrase')).toBeTruthy()
    expect(screen.getByText('/home/hakim/.ssh/id_rsa')).toBeTruthy()

    const input = screen.getByPlaceholderText(/Enter passphrase…/) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'my-passphrase' } })

    const submitBtn = screen.getByRole('button', { name: 'Unlock & Continue' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(gitAskPassReply).toHaveBeenCalledWith({
        requestId: 'req-123',
        passphrase: 'my-passphrase',
        remember: true
      })
    })

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByText('SSH Key Passphrase')).toBeNull()
    })
  })

  it('handles cancel button', async () => {
    let askPassListener: ((req: GitAskPassRequest) => void) | undefined
    const gitAskPassReply = vi.fn(async () => {})

    window.workspace = {
      onGitAskPass: (callback: (req: GitAskPassRequest) => void) => {
        askPassListener = callback
        return () => { askPassListener = undefined }
      },
      gitAskPassReply
    } as any

    render(<Provider><GitAskPassModal /></Provider>)

    askPassListener?.({
      requestId: 'req-cancel',
      prompt: "Enter passphrase for key '/home/hakim/.ssh/id_rsa': ",
      key: '/home/hakim/.ssh/id_rsa'
    })

    expect(await screen.findByText('SSH Key Passphrase')).toBeTruthy()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(gitAskPassReply).toHaveBeenCalledWith({
        requestId: 'req-cancel',
        canceled: true
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('SSH Key Passphrase')).toBeNull()
    })
  })

  it('allows submitting an empty passphrase and clicking skip key', async () => {
    let askPassListener: ((req: GitAskPassRequest) => void) | undefined
    const gitAskPassReply = vi.fn(async () => {})

    window.workspace = {
      onGitAskPass: (callback: (req: GitAskPassRequest) => void) => {
        askPassListener = callback
        return () => { askPassListener = undefined }
      },
      gitAskPassReply
    } as any

    render(<Provider><GitAskPassModal /></Provider>)

    // 1. Test empty passphrase submission
    askPassListener?.({
      requestId: 'req-empty',
      prompt: "Enter passphrase for key '/home/hakim/.ssh/id_rsa': ",
      key: '/home/hakim/.ssh/id_rsa'
    })

    const submitBtn = await screen.findByRole('button', { name: 'Unlock & Continue' })
    // Button should NOT be disabled when passphrase is empty
    expect(submitBtn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(gitAskPassReply).toHaveBeenCalledWith({
        requestId: 'req-empty',
        passphrase: '',
        remember: true
      })
    })

    // 2. Test Skip Key button
    askPassListener?.({
      requestId: 'req-skip',
      prompt: "Enter passphrase for key '/home/hakim/.ssh/id_rsa': ",
      key: '/home/hakim/.ssh/id_rsa'
    })

    const skipBtn = await screen.findByRole('button', { name: 'Skip Key' })
    fireEvent.click(skipBtn)

    await waitFor(() => {
      expect(gitAskPassReply).toHaveBeenCalledWith({
        requestId: 'req-skip',
        skip: true,
        remember: true
      })
    })
  })
})
