import { Button } from '@chakra-ui/react'
import shumoraLogo from './assets/shumora-logo.png'

export type Page = 'workspace' | 'settings'
function NavIcon({ type }: { type: 'terminal' | 'settings' | 'collapse' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'terminal' ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3m6 0h4" /></>
      : type === 'settings' ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--sidebar)" /><circle cx="15" cy="17" r="3" fill="var(--sidebar)" /></>
        : <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m7-11-3 3 3 3" /></>}
  </svg>
}
export function Sidebar({ page, onPage, collapsed, onToggle }: { page: Page; onPage: (page: Page) => void; collapsed: boolean; onToggle: () => void }) {
  return <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main sidebar">
    <div className="sidebar-brand"><img className="sidebar-logo" src={shumoraLogo} alt="" aria-hidden="true" /><span className="sidebar-label" aria-hidden={collapsed}>Shumora</span></div>
    <nav aria-label="Main navigation" className="sidebar-navigation">
      <Button variant="ghost" aria-label="AI Workspace" title={collapsed ? 'AI Workspace' : undefined} aria-current={page === 'workspace' ? 'page' : undefined} onClick={() => onPage('workspace')}><NavIcon type="terminal" /><span className="sidebar-label" aria-hidden={collapsed}>AI Workspace</span></Button>
      <Button variant="ghost" aria-label="Settings" title={collapsed ? 'Settings' : undefined} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => onPage('settings')}><NavIcon type="settings" /><span className="sidebar-label" aria-hidden={collapsed}>Settings</span></Button>
    </nav>
    <div className="sidebar-bottom"><Button variant="ghost" bg="transparent" _hover={{ bg: 'var(--selected)', color: 'var(--selected-text)' }} _active={{ bg: 'var(--selected)', color: 'var(--selected-text)' }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : undefined} aria-expanded={!collapsed} onClick={onToggle}><span className={`collapse-icon ${collapsed ? 'expanded-direction' : ''}`}><NavIcon type="collapse" /></span><span className="sidebar-label" aria-hidden={collapsed}>Collapse</span></Button></div>
  </aside>
}
