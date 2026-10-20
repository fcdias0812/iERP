import { api } from './http'
import type {
  AcaoCadastro,
  Integracao,
  IntegracaoDetalhe,
  IntegracaoInput,
  SistemaIntegravel,
} from './types'

/* Administração › Integração: os sistemas de fora (MoonShot…), a chave e os avisos. */

export const integracoesKeys = {
  lista: ['integracoes', 'lista'] as const,
  sistemas: ['integracoes', 'sistemas'] as const,
  detalhe: (id: string) => ['integracoes', 'detalhe', id] as const,
}

export const listarIntegracoes = (signal?: AbortSignal) =>
  api<Integracao[]>('/integracoes', { signal })
export const listarSistemasIntegraveis = (signal?: AbortSignal) =>
  api<SistemaIntegravel[]>('/integracoes/sistemas', { signal })
export const obterIntegracao = (id: string, signal?: AbortSignal) =>
  api<IntegracaoDetalhe>(`/integracoes/${id}`, { signal })
export const criarIntegracao = (input: IntegracaoInput) =>
  api<IntegracaoDetalhe>('/integracoes', { method: 'POST', body: input })
export const atualizarIntegracao = (id: string, input: IntegracaoInput) =>
  api<IntegracaoDetalhe>(`/integracoes/${id}`, { method: 'PUT', body: input })
/** Gera (ou troca) a chave: a resposta traz a chave crua — só desta vez. */
export const gerarChaveIntegracao = (id: string) =>
  api<{ chave: string; integracao: IntegracaoDetalhe }>(`/integracoes/${id}/chave`, {
    method: 'POST',
  })
export const revogarChaveIntegracao = (id: string) =>
  api<IntegracaoDetalhe>(`/integracoes/${id}/chave`, { method: 'DELETE' })
export const transicionarIntegracao = (id: string, acao: AcaoCadastro) =>
  api<IntegracaoDetalhe>(`/integracoes/${id}/transicao`, { method: 'POST', body: { acao } })
