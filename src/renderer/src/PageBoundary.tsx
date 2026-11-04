import { Component, type ReactNode } from 'react'
import { useLanguage } from './Language'

function LoadError() {
  const { t } = useLanguage()
  return <main className="library-page"><p role="alert">{t('Could not load this page. Switch back to Terminals and restart Shumora when your work is saved.')}</p></main>
}

// Keep optional-page import failures out of the persistent terminal workspace.
export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <LoadError /> : this.props.children }
}
