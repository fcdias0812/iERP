/*
 * Cliente HTTP da aplicação. TODA chamada de dados passa por aqui (via services/*).
 * Por padrão fala com a API real (server/, em /api — no dev o Vite encaminha para a porta
 * 3001). Com VITE_USE_MOCKS=true quem responde é a API simulada (src/mocks) — nenhuma tela muda.
 */

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

/** Erro tipado devolvido pela API. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isNotFound() {
    return this.status === 404
  }
  get isForbidden() {
    return this.status === 403
  }
  get isConflict() {
    return this.status === 409
  }
}

type Query = Record<string, string | number | boolean | object | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

/** Monta a URL absoluta (objetos na query viram JSON, como no estado da tabela). */
export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  }
  // Demonstração (só com a API simulada): `?_erro=500` no endereço da tela vale para as chamadas.
  if (import.meta.env.VITE_USE_MOCKS === 'true' && !url.searchParams.has('_erro')) {
    const forced = new URLSearchParams(window.location.search).get('_erro')
    if (forced) url.searchParams.set('_erro', forced)
  }
  return url.toString()
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal } = options
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      // FormData (envio de arquivo): o navegador monta o multipart e o cabeçalho sozinho.
      headers:
        body === undefined || body instanceof FormData
          ? undefined
          : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, 'network', 'Falha de conexão com o servidor.')
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const err = (data ?? {}) as { code?: string; message?: string; details?: unknown }
    throw new ApiError(
      response.status,
      err.code ?? 'error',
      err.message ?? response.statusText,
      err.details,
    )
  }
  // 200 sem JSON (ex.: o servidor devolveu HTML) é erro, nunca "dado vazio".
  if (data === undefined)
    throw new ApiError(response.status, 'invalid_response', 'Resposta inválida do servidor.')
  return data as T
}
