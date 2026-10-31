import { useLanguage } from './Language'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@chakra-ui/react'
import type { PackagePage, PiPackage, PackageQuery } from '../../shared/packages'
import { DataSkeleton } from './DataSkeleton'
import { PackagePreview } from './PackagePreview'

// Catalog browsing state (page/search/type/sort) is lifted to the Library parent
// so it survives opening and closing a package detail page.
export function Packages({ query, onQueryChange, onSelect, banner }: {
  query: PackageQuery
  onQueryChange: (patch: Partial<PackageQuery>) => void
  onSelect: (item: PiPackage) => void
  banner?: ReactNode
}) {
  const { t } = useLanguage()
  const { page = 1, search = '', type = '', sort = 'downloads' } = query
  const [draft, setDraft] = useState(search)
  const [data, setData] = useState<PackagePage>()
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true; setBusy(true); setError('')
    void window.packages?.catalog({ page, search, type, sort }).then(value => { if (alive) setData(value) }).catch(() => { if (alive) setError('Cannot load the Pi package gallery. Check your connection and try Refresh.') }).finally(() => { if (alive) setBusy(false) })
    if (!window.packages) { setError('Restart Shumora to load the package bridge.'); setBusy(false) }
    return () => { alive = false }
  }, [page, search, type, sort, refresh])
  return <section className="package-catalog">
    {banner}
    <div className="router-catalog-heading"><div><h2>{t("Pi Packages")}</h2><p>{t("Extensions, skills, themes and prompts from pi.dev/packages.")}</p></div><Button variant="outline" disabled={busy} onClick={() => setRefresh(value => value + 1)}>{t("Refresh")}</Button></div>
    <form className="router-control-actions package-filters" onSubmit={e => { e.preventDefault(); onQueryChange({ search: draft, page: 1 }) }}>
      <input aria-label={t("Search packages")} placeholder={t("Search Pi packages…")} value={draft} onChange={e => setDraft(e.target.value)} />
      <Button type="submit" variant="outline">{t("Search")}</Button>
      <select aria-label={t("Package type")} value={type} onChange={e => onQueryChange({ type: e.target.value, page: 1 })}><option value="">{t("All types")}</option>{['extension', 'skill', 'theme', 'prompt'].map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label={t("Sort packages")} value={sort} onChange={e => onQueryChange({ sort: e.target.value, page: 1 })}><option value="downloads">{t("Popular")}</option><option value="recent">{t("Recently updated")}</option><option value="name">{t("Name")}</option></select>
    </form>
    {error && <p className="plugin-error" role="alert">{t(error)}</p>}
    {busy ? <DataSkeleton label={t("Loading packages")} shape="providers" /> : <>
      <div className="router-catalog-grid library-card-grid">
        {data?.items.map(item => <button key={item.name} className="package-catalog-card" aria-label={t("View {name}", { name: item.name })} onClick={() => onSelect(item)}>
          <PackagePreview key={`${item.name}-${item.thumbnail || ''}`} item={item} />
          <strong>{item.name}</strong>
          <p>{item.description}</p>
          <small>{item.author} · {item.downloads.toLocaleString()} {t("downloads/month")}</small>
          <span>{item.types.join(' · ') || t("package")} · {item.version}</span>
          <small>{!item.installation ? t("Installation unverified") : item.installation.installed ? t("Installed · {version}", { version: item.installation.installedVersion || "" }) + (item.installation.installedVersion !== item.version ? t(" · Different catalog version available") : "") : item.installation.configured ? t("Configured · Repair needed") : t("Not installed")}</small>
        </button>)}
      </div>
      {!error && !data?.items.length && <p>{t("No matching packages.")}</p>}
      <nav className="router-control-actions" aria-label={t("Package pages")}><Button variant="outline" disabled={page <= 1} onClick={() => onQueryChange({ page: page - 1 })}>{t("Previous")}</Button><span>{t("Page")} {page} {t("of")} {data?.pages || page}</span><Button variant="outline" disabled={!data || page >= data.pages} onClick={() => onQueryChange({ page: page + 1 })}>{t("Next")}</Button></nav>
    </>}
  </section>
}
