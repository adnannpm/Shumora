// @vitest-environment jsdom
import React, { useLayoutEffect, useRef } from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PackagePreview } from '../src/renderer/src/PackagePreview'
afterEach(cleanup)

it('keeps the fallback when an image fails before passive mount effects run', () => {
  function EarlyFailure() {
    const ref = useRef<HTMLDivElement>(null)
    useLayoutEffect(() => { ref.current!.querySelector('img')!.dispatchEvent(new Event('error')) }, [])
    return <div ref={ref}><PackagePreview item={{ name: 'preview-demo', thumbnail: 'https://images.example.com/broken.png' }} /></div>
  }
  render(<EarlyFailure />)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('PR')).toBeTruthy()
})
it('retries a new thumbnail or package without reviving the failed image on ordinary rerenders', () => {
  const item = { name: 'preview-demo', thumbnail: 'https://images.example.com/broken.png' }
  const view = render(<PackagePreview item={item} />)
  fireEvent.error(screen.getByRole('img'))
  view.rerender(<PackagePreview item={{ ...item }} />)
  expect(screen.queryByRole('img')).toBeNull()
  view.rerender(<PackagePreview item={{ ...item, thumbnail: 'https://images.example.com/new.png' }} />)
  expect(screen.getByRole('img').getAttribute('src')).toBe('https://images.example.com/new.png')
  fireEvent.error(screen.getByRole('img'))
  view.rerender(<PackagePreview item={{ ...item, name: 'another-package', thumbnail: 'https://images.example.com/new.png' }} />)
  expect(screen.getByRole('img', { name: 'another-package preview' })).toBeTruthy()
})
