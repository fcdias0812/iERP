import { api } from './http'
import type {
  AbaEstoque,
  EstoqueDeFora,
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
