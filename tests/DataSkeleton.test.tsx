// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { DataSkeleton } from '../src/renderer/src/DataSkeleton'
afterEach(cleanup)
it('matches provider cards and the current model table instead of model cards', () => {
  const view = render(<Provider><DataSkeleton label="Loading providers" shape="providers" /></Provider>)
  expect(screen.getByRole('status').querySelectorAll('.router-overview-card')).toHaveLength(4)
  expect(screen.getByRole('status').querySelector('.router-catalog-grid')).toBeTruthy()
  view.rerender(<Provider><DataSkeleton label="Loading models" shape="models" /></Provider>)
  const loading = screen.getByRole('status', { name: 'Loading models' })
  expect(loading.getAttribute('aria-busy')).toBe('true')
  expect(loading.querySelector('.router-catalog-grid')).toBeNull()
  expect(loading.querySelector('.router-overview-card')).toBeNull()
  expect(loading.querySelector('.router-model-table-scroll')).toBeTruthy()
  expect(loading.querySelectorAll('thead th')).toHaveLength(4)
  expect(Array.from(loading.querySelectorAll('thead th')).map(cell => cell.textContent)).toEqual(['Models', 'Connection status', 'Routing alias', 'Actions'])
  expect(loading.querySelectorAll('tbody tr')).toHaveLength(6)
  for (const row of loading.querySelectorAll('tbody tr')) {
    expect(row.children).toHaveLength(4)
    expect(row.querySelector('.router-model-identity')).toBeTruthy()
    expect(row.querySelector('.router-model-alias-inline')).toBeTruthy()
  }
  expect(loading.querySelector('.router-model-results')).toBeTruthy()
  expect(loading.querySelector('.router-model-pagination')).toBeTruthy()
  expect(loading.querySelector('button, input')).toBeNull()
})
it('matches detail rows and the full-height log surface', () => {
  const view = render(<Provider><DataSkeleton label="Loading details" shape="details" rows={3} /></Provider>)
  expect(screen.getByRole('status').querySelectorAll('.skeleton-detail-row')).toHaveLength(3)
  view.rerender(<Provider><DataSkeleton label="Loading logs" shape="logs" /></Provider>)
  expect(screen.getByRole('status').querySelector('.plugin-output-log')).toBeTruthy()
})
