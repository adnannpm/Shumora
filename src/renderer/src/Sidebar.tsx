import { Button } from '@chakra-ui/react'
import shumoraLogo from './assets/shumora-logo.png'

export type Page = 'workspace' | '9router' | 'library' | 'settings'
function NavIcon({ type }: { type: 'terminal' | 'router' | 'library' | 'settings' | 'collapse' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'terminal' ? <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3m6 0h4" /></>
      : type === 'router' ? <><rect x="8" y="3" width="8" height="6" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 9v4M6 16v-3h12v3" /></>
      : type === 'library' ? <><path d="M4 4h4v16H4zM10 4h4v16h-4zM17 4l4 15-4 1-4-15" /></>
      : type === 'settings' ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--sidebar)" /><circle cx="15" cy="17" r="3" fill="var(--sidebar)" /></>
        : <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16m7-11-3 3 3 3" /></>}
  </svg>
}
export function Sidebar({ page, onPage, collapsed, onToggle, routerInstalled }: { page: Page; onPage: (page: Page) => void; collapsed: boolean; onToggle: () => void; routerInstalled: boolean }) {
  return <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Main sidebar">
    <div className="sidebar-brand"><img className="sidebar-logo" src={shumoraLogo} alt="" aria-hidden="true" /><span className="sidebar-label" aria-hidden={collapsed}>Shumora</span></div>
    <nav aria-label="Main navigation" className="sidebar-navigation">
      <div className="sidebar-group" role="group" aria-label="Workspace"><div className="sidebar-group-label" aria-hidden="true">{!collapsed && 'Workspace'}</div>
      <Button variant="ghost" aria-label="Terminals" title={collapsed ? 'Terminals' : undefined} aria-current={page === 'workspace' ? 'page' : undefined} onClick={() => onPage('workspace')}><NavIcon type="terminal" /><span className="sidebar-label" aria-hidden={collapsed}>Terminals</span></Button>
      </div>
      {routerInstalled && <div className="sidebar-group" role="group" aria-label="Integrations"><div className="sidebar-group-label" aria-hidden="true">{!collapsed && 'Integrations'}</div>
      <Button variant="ghost" aria-label="9router" title={collapsed ? '9router' : undefined} aria-current={page === '9router' ? 'page' : undefined} onClick={() => onPage('9router')}><NavIcon type="router" /><span className="sidebar-label" aria-hidden={collapsed}>9router</span></Button>
      </div>}
      <div className="sidebar-group" role="group" aria-label="Manage"><div className="sidebar-group-label" aria-hidden="true">{!collapsed && 'Manage'}</div>
      <Button variant="ghost" aria-label="Library" title={collapsed ? 'Library' : undefined} aria-current={page === 'library' ? 'page' : undefined} onClick={() => onPage('library')}><NavIcon type="library" /><span className="sidebar-label" aria-hidden={collapsed}>Library</span></Button>
      <Button variant="ghost" aria-label="Settings" title={collapsed ? 'Settings' : undefined} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => onPage('settings')}><NavIcon type="settings" /><span className="sidebar-label" aria-hidden={collapsed}>Settings</span></Button>
      </div>
    </nav>
    <div className="sidebar-bottom"><Button variant="ghost" bg="transparent" _hover={{ bg: 'var(--selected)', color: 'var(--selected-text)' }} _active={{ bg: 'var(--selected)', color: 'var(--selected-text)' }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : undefined} aria-expanded={!collapsed} onClick={onToggle}><span className={`collapse-icon ${collapsed ? 'expanded-direction' : ''}`}><NavIcon type="collapse" /></span><span className="sidebar-label" aria-hidden={collapsed}>Collapse</span></Button></div>
  </aside>
}
