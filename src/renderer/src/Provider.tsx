import { ChakraProvider, createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { AppearanceProvider } from './Appearance'
import { LanguageProvider } from './Language'

// Tailwind owns the reset and workspace layout. Chakra owns component recipes.
const system = createSystem(defaultConfig, defineConfig({
  preflight: false,
  globalCss: {},
  theme: {
    tokens: {
      fonts: { body: { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' } },
      colors: {
        brand: {
          50: { value: '#edf2fd' }, 100: { value: '#dce7fc' }, 200: { value: '#b8cdf6' },
          300: { value: '#8aaaf0' }, 400: { value: '#5c86e0' }, 500: { value: '#3868d4' },
          600: { value: '#2456c4' }, 700: { value: '#1c46a1' }, 800: { value: '#193b80' }, 900: { value: '#193366' }, 950: { value: '#102044' }
        }
      }
    },
    // Portalled components must use the same palette as the application shell.
    // Override both conditions: Chakra's default _dark values otherwise win.
    semanticTokens: { colors: {
      bg: {
        DEFAULT: { value: { base: 'var(--surface)', _dark: 'var(--surface)' } },
        panel: { value: { base: 'var(--surface)', _dark: 'var(--surface)' } },
        subtle: { value: { base: 'var(--sidebar)', _dark: 'var(--sidebar)' } },
        muted: { value: { base: 'var(--canvas)', _dark: 'var(--canvas)' } },
        emphasized: { value: { base: 'var(--selected)', _dark: 'var(--selected)' } }
      },
      fg: {
        DEFAULT: { value: { base: 'var(--text)', _dark: 'var(--text)' } },
        muted: { value: { base: 'var(--muted)', _dark: 'var(--muted)' } },
        subtle: { value: { base: 'var(--muted)', _dark: 'var(--muted)' } }
      },
      border: {
        DEFAULT: { value: { base: 'var(--line)', _dark: 'var(--line)' } },
        muted: { value: { base: 'var(--line)', _dark: 'var(--line)' } },
        subtle: { value: { base: 'var(--line)', _dark: 'var(--line)' } }
      },
      brand: {
        solid: { value: '{colors.brand.600}' }, contrast: { value: '#ffffff' },
        fg: { value: { base: 'var(--accent)', _dark: 'var(--accent)' } },
        subtle: { value: { base: 'var(--selected)', _dark: 'var(--selected)' } },
        muted: { value: { base: 'var(--selected)', _dark: 'var(--selected)' } },
        emphasized: { value: { base: 'var(--selected)', _dark: 'var(--selected)' } },
        focusRing: { value: { base: 'var(--accent)', _dark: 'var(--accent)' } }
      }
    } }
  }
}))
export function Provider({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}><LanguageProvider><AppearanceProvider>{children}</AppearanceProvider></LanguageProvider></ChakraProvider>
}
