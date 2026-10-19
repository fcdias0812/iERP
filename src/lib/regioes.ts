import type { RegiaoBrasil } from '@/services/types'

/*
 * Regiões do Brasil (lista fechada do site do cliente — pedido do usuário, 19/10/2026). Guarda o
 * código; o rótulo sai de `clientes.sites.regioes.<código>`. Espelho de server/src/shared/regioes.ts.
 */
export const REGIOES: RegiaoBrasil[] = ['norte', 'nordeste', 'centro_oeste', 'sudeste', 'sul']
