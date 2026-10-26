// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { DataSkeleton } from '../src/renderer/src/DataSkeleton'
afterEach(cleanup)
it('matches provider cards and model card controls instead of generic lines', () => {
  const view = render(<Provider><DataSkeleton label="Loading providers" shape="providers" /></Provider>)
  expect(screen.getByRole('status').querySelectorAll('.router-overview-card')).toHaveLength(4)
  expect(screen.getByRole('status').querySelector('.router-catalog-grid')).toBeTruthy()
  view.rerender(<Provider><DataSkeleton label="Loading models" shape="models" /></Provider>)
  expect(screen.getByRole('status').querySelectorAll('.skeleton-endpoint')).toHaveLength(4)
})
it('matches detail rows and the full-height log surface', () => {
  const view = render(<Provider><DataSkeleton label="Loading details" shape="details" rows={3} /></Provider>)
  expect(screen.getByRole('status').querySelectorAll('.skeleton-detail-row')).toHaveLength(3)
  view.rerender(<Provider><DataSkeleton label="Loading logs" shape="logs" /></Provider>)
  expect(screen.getByRole('status').querySelector('.plugin-output-log')).toBeTruthy()
})
