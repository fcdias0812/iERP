import { create } from 'zustand'

/** Estado passageiro do shell (não é salvo): o que está aberto agora. */
interface ShellState {
  commandOpen: boolean
  shortcutsOpen: boolean
  mobileNavOpen: boolean
  signOutOpen: boolean
  setCommandOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setSignOutOpen: (open: boolean) => void
}

export const useShellStore = create<ShellState>()((set) => ({
  commandOpen: false,
  shortcutsOpen: false,
  mobileNavOpen: false,
  signOutOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setSignOutOpen: (signOutOpen) => set({ signOutOpen }),
}))
