import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'
export type Language = 'pt-BR' | 'en' | 'zh-TW'

interface UiState {
  theme: ThemePreference
  density: Density
  language: Language
  sidebarCollapsed: boolean
  setTheme: (theme: ThemePreference) => void
  setDensity: (density: Density) => void
  setLanguage: (language: Language) => void
  toggleSidebar: () => void
}

/**
 * Preferências de interface, salvas no navegador (chave `reteck-ui`).
 * O script inline do index.html lê a mesma chave para aplicar tema/densidade
 * antes da primeira pintura.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      density: 'comfortable',
      language: 'pt-BR',
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'reteck-ui', version: 1 },
  ),
)
