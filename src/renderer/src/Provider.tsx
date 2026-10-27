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
    semanticTokens: { colors: { brand: {
      solid: { value: '{colors.brand.600}' }, contrast: { value: '#ffffff' },
      fg: { value: '{colors.brand.700}' }, subtle: { value: '{colors.brand.50}' },
      muted: { value: '{colors.brand.100}' }, emphasized: { value: '{colors.brand.200}' }, focusRing: { value: '{colors.brand.500}' }
    } } }
  }
}))
export function Provider({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}><LanguageProvider><AppearanceProvider>{children}</AppearanceProvider></LanguageProvider></ChakraProvider>
}
