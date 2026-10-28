import { useState } from 'react'
import type { PiPackage } from '../../shared/packages'

// A short, stable identity badge for packages without (or with a broken) thumbnail.
// Keeps every catalog/detail slot the same bounded size whether or not real media exists.
function initials(name: string): string {
  const base = name.replace(/^@[^/]+\//, '')
  return base.slice(0, 2).toUpperCase()
}

export function PackagePreview({ item, variant = 'card' }: { item: Pick<PiPackage, 'name' | 'thumbnail'>; variant?: 'card' | 'detail' }) {
  // A new image identity gets fresh state before it can emit an error.
  // A passive reset effect could otherwise erase an early image failure.
  return <PreviewContent key={JSON.stringify([item.name, item.thumbnail])} item={item} variant={variant} />
}

function PreviewContent({ item, variant }: { item: Pick<PiPackage, 'name' | 'thumbnail'>; variant: 'card' | 'detail' }) {
  const [failed, setFailed] = useState(false)
  const showImage = !!item.thumbnail && !failed
  const className = variant === 'detail' ? 'package-preview package-preview-detail' : 'package-preview package-preview-card'
  return <div className={className}>
    {showImage
      ? <img src={item.thumbnail} alt={`${item.name} preview`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span className="package-preview-identity" aria-hidden="true">{initials(item.name)}</span>}
  </div>
}
