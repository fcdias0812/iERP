/*
 * VERSÃO NOVA DO SISTEMA (pedido do usuário, 28/10/2026: "Sempre que o sistema detectar uma versão
 * mais recente, vai aparecer um pop up..."). Cada build tem um identificador (vite.config.ts):
 * o desta página (`__IERP_BUILD__`) e o publicado no servidor (`version.json`). Diferentes = há
 * uma versão nova para carregar.
 */

/** O build desta página. */
export const BUILD_ATUAL = __IERP_BUILD__

/** De quanto em quanto tempo a página pergunta (ms) — e também ao voltar para a aba. */
export const INTERVALO_ATUALIZACAO_MS = 5 * 60_000

/** O build publicado no servidor, ou null (sem `version.json`, rede fora, resposta estranha). */
export async function buildPublicado(signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    })
    if (!r.ok) return null
    const corpo = (await r.json()) as { build?: unknown }
    return typeof corpo.build === 'string' && corpo.build ? corpo.build : null
  } catch {
    return null
  }
}

/** Há versão nova? (sem resposta do servidor, não) */
export const haVersaoNova = (publicado: string | null, atual: string = BUILD_ATUAL) =>
  publicado !== null && publicado !== atual
