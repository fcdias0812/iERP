import { Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeController } from './ThemeController'

/** Raiz da aplicação: sincroniza preferências e renderiza a rota atual. */
export function RootLayout() {
  return (
    <TooltipProvider>
      <ThemeController />
      <Outlet />
      <Toaster />
    </TooltipProvider>
  )
}
