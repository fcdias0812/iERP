import { api } from './http'
import type {
  AbaEstoque,
  EstoqueDeFora,
  EventoEstoque,
  MaquinaDeFora,
  MaterialDeFora,
  PosicaoEcommerce,
} from './types'

/*
 * Estoque: as listas dos sistemas de fora (armazém, Controle de Notebooks, RTB WMS), lidas ao vivo
 * pelo servidor (guardadas 1 minuto lá). "Atualizar" pede a leitura na hora.
 */

export interface LinhasPorAba {
  materiais: MaterialDeFora
  assets: MaquinaDeFora
  pecas: MaquinaDeFora
  ecommerce: PosicaoEcommerce
}

export const estoqueKeys = {
  aba: (aba: AbaEstoque) => ['estoque', aba] as const,
  historico: (desde: string | null) => ['estoque', 'historico', desde] as const,
}

export const listarEstoque = <A extends AbaEstoque>(
  aba: A,
  atualizar = false,
  signal?: AbortSignal,
) =>
  api<EstoqueDeFora<LinhasPorAba[A]>>(`/estoque/${aba}`, {
    query: atualizar ? { atualizar: 1 } : undefined,
    signal,
  })

/** Estoque › Histórico: entrou, saiu e mudou (desde = início do período, ISO). */
export const listarHistoricoEstoque = (desde: string | null, signal?: AbortSignal) =>
  api<EventoEstoque[]>('/estoque/historico', { query: { desde: desde ?? undefined }, signal })
