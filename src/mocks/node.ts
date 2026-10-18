import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** API simulada nos testes (Vitest). */
export const server = setupServer(...handlers)
