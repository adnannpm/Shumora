import { createRoot } from 'react-dom/client'
import App from './App'
import { Provider } from './Provider'
import { ReleaseNotesProvider } from './ReleaseNotes'
import '@xterm/xterm/css/xterm.css'
import './style.css'
createRoot(document.getElementById('root')!).render(<Provider><ReleaseNotesProvider><App /></ReleaseNotesProvider></Provider>)
