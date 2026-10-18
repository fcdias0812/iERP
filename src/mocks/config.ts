import { delay } from 'msw/utils/delay'
import { HttpResponse } from 'msw/http'

/*
 * Comportamento do servidor simulado:
 *  - latência aleatória entre `latency[0]` e `latency[1]` ms;
 *  - taxa de erro 500 (VITE_MOCK_ERROR_RATE, de 0 a 1; padrão 0);
 *  - `?_erro=500` (ou 404, 409…) em qualquer chamada força o erro.
 * Nos testes a latência é zero.
 */
export const mockConfig = {
  latency: import.meta.env.MODE === 'test' ? ([0, 0] as const) : ([200, 800] as const),
  errorRate: Number(import.meta.env.VITE_MOCK_ERROR_RATE ?? 0),
}

/** Simula a rede: espera a latência e, se for o caso, devolve um erro. */
export async function simulateNetwork(request: Request): Promise<Response | undefined> {
  const [min, max] = mockConfig.latency
  if (max > 0) await delay(min + Math.random() * (max - min))
  const forced = new URL(request.url).searchParams.get('_erro')
  if (forced) return apiError(Number(forced) || 500, 'simulated', 'Erro simulado (_erro).')
  if (mockConfig.errorRate > 0 && Math.random() < mockConfig.errorRate)
    return apiError(500, 'simulated', 'Erro simulado do servidor.')
  return undefined
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json({ code, message, details }, { status })
}
