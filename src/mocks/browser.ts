import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** API simulada no navegador (Service Worker). Iniciada em src/main.tsx. */
export const worker = setupWorker(...handlers)
