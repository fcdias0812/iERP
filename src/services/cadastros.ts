import { api } from './http'
import type {
  AcaoCadastro,
  AreaEstoque,
  AreaEstoqueDetalhe,
  AreaEstoqueInput,
  Material,
  MaterialDetalhe,
  MaterialInput,
  Recipiente,
  RecipienteDetalhe,
  RecipienteInput,
  TipoRecipiente,
} from './types'

/*
 * Sistema › Cadastros: materiais, áreas do estoque e recipientes (caixotes e pallets).
 * Listas pequenas: a API devolve a lista inteira (a tela filtra e ordena).
 */

/** Chamadas de um cadastro (o mesmo molde para os três). */
function recurso<Item, Detalhe, Input>(caminho: string) {
  return {
    listar: (signal?: AbortSignal, query?: Record<string, string>) =>
      api<Item[]>(caminho, { query, signal }),
    obter: (id: string, signal?: AbortSignal) => api<Detalhe>(`${caminho}/${id}`, { signal }),
    criar: (input: Input) => api<Detalhe>(caminho, { method: 'POST', body: input }),
    atualizar: (id: string, input: Input) =>
      api<Detalhe>(`${caminho}/${id}`, { method: 'PUT', body: input }),
    transicionar: (id: string, acao: AcaoCadastro) =>
      api<Detalhe>(`${caminho}/${id}/transicao`, { method: 'POST', body: { acao } }),
  }
}

export const materiaisApi = recurso<Material, MaterialDetalhe, MaterialInput>('/materiais')
export const areasApi = recurso<AreaEstoque, AreaEstoqueDetalhe, AreaEstoqueInput>('/areas')
export const recipientesApi = recurso<Recipiente, RecipienteDetalhe, RecipienteInput>(
  '/recipientes',
)

export const cadastrosKeys = {
  materiais: ['materiais'] as const,
  areas: ['areas'] as const,
  recipientes: (tipo: TipoRecipiente) => ['recipientes', tipo] as const,
}
