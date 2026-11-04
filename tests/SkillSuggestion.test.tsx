// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SkillSuggestion } from '../src/renderer/src/SkillSuggestion'
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('offers optional skill discovery for a verified empty skill list and respects permanent dismissal', async () => {
  window.workspace = { skillStatus: async () => ({ pi: 0 }), onSkillsChange: () => () => {} } as any
  const onFind = vi.fn()
  const view = render(<SkillSuggestion onFind={onFind} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Find skills' }))
  expect(onFind).toHaveBeenCalledOnce()
  view.unmount()
  render(<SkillSuggestion onFind={onFind} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Don’t show again' }))
  cleanup()
  render(<SkillSuggestion onFind={onFind} />)
  expect(screen.queryByRole('button', { name: 'Find skills' })).toBeNull()
})
it('does not mistake unknown skill availability or installed skills for an empty list', async () => {
  window.workspace = { skillStatus: async () => ({ pi: 3 }), onSkillsChange: () => () => {} } as any
  render(<SkillSuggestion onFind={() => {}} />)
  await Promise.resolve()
  expect(screen.queryByRole('button', { name: 'Find skills' })).toBeNull()
})
