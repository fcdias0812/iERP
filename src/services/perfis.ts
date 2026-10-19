import { api } from './http'
import type {
  AcaoCadastro,
  EventoAuditoria,
  PerfilAcesso,
  PerfilAcessoDetalhe,
  PerfilAcessoInput,
} from './types'

/* Administração › Perfis de acesso e Auditoria. */

export const perfisKeys = {
  lista: ['perfis', 'lista'] as const,
  detalhe: (id: string) => ['perfis', 'detalhe', id] as const,
  auditoria: (desde: string | null) => ['auditoria', desde] as const,
}

export const listarPerfis = (signal?: AbortSignal) => api<PerfilAcesso[]>('/perfis', { signal })
export const obterPerfil = (id: string, signal?: AbortSignal) =>
  api<PerfilAcessoDetalhe>(`/perfis/${id}`, { signal })
export const criarPerfil = (input: PerfilAcessoInput) =>
  api<PerfilAcessoDetalhe>('/perfis', { method: 'POST', body: input })
export const atualizarPerfil = (id: string, input: PerfilAcessoInput) =>
  api<PerfilAcessoDetalhe>(`/perfis/${id}`, { method: 'PUT', body: input })
export const transicionarPerfil = (id: string, acao: AcaoCadastro) =>
  api<PerfilAcessoDetalhe>(`/perfis/${id}/transicao`, { method: 'POST', body: { acao } })

/** Auditoria: todos os eventos desde a data (ISO); null = tudo. */
export const listarAuditoria = (desde: string | null, signal?: AbortSignal) =>
  api<EventoAuditoria[]>('/auditoria', { query: desde ? { desde } : {}, signal })
