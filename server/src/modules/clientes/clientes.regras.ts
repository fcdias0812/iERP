import { z } from 'zod'
import type { ColunaConsulta } from '../../shared/consulta-tabela.js'
import {
  cnpjValido,
  limparTelefone,
  soAlfanumerico,
  telefoneValido,
} from '../../shared/documentos.js'
import type { AcaoCliente, ClienteStatus } from './clientes.types.js'

/* Regras do cadastro de clientes: fluxo de status, validação e colunas da lista. */

export const STATUS = ['ativo', 'inativo'] as const

/** Fluxo: Ativo ⇄ Inativo (cliente não é excluído: o histórico fica). */
export const TRANSICOES: Record<ClienteStatus, Partial<Record<AcaoCliente, ClienteStatus>>> = {
  ativo: { inativar: 'inativo' },
  inativo: { reativar: 'ativo' },
}

export const acoesDe = (status: ClienteStatus) => Object.keys(TRANSICOES[status]) as AcaoCliente[]

export const MAX_CONTATOS = 20

const contatoSchema = z.object({
  nome: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => v || null),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail do contato inválido.').max(160)),
  telefone: z
    .string()
    .transform(limparTelefone)
    .refine(telefoneValido, 'Telefone do contato inválido (DDD + número).'),
  principal: z.boolean(),
})

export const clienteInputSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
  cnpj: z.string().transform(soAlfanumerico).refine(cnpjValido, 'CNPJ inválido.'),
  contatos: z
    .array(contatoSchema)
    .min(1, 'Informe pelo menos um contato.')
    .max(MAX_CONTATOS)
    .refine(
      (l) => l.filter((c) => c.principal).length === 1,
      'Marque exatamente um contato como principal.',
    ),
})

export const transicaoSchema = z.object({ acao: z.enum(['inativar', 'reativar']) })

/** Código legível: CLI-00001. */
export const codigoCliente = (numero: number) => `CLI-${String(numero).padStart(5, '0')}`

/** Colunas que a lista sabe filtrar/ordenar (ids = campos de ClienteResumo / view clientes_lista). */
export const COLUNAS_CLIENTE: ColunaConsulta[] = [
  { id: 'codigo', tipo: 'unique-text' },
  { id: 'nome', tipo: 'unique-text' },
  { id: 'cnpj', tipo: 'unique-text', limpar: soAlfanumerico },
  { id: 'contatoEmail', tipo: 'unique-text' },
  { id: 'contatoTelefone', tipo: 'unique-text', limpar: limparTelefone },
  { id: 'contatos', tipo: 'number' },
  // Ordem do fluxo = flowOrder do statusMap do frontend.
  { id: 'status', tipo: 'status', ordem: { ativo: 130, inativo: 420 } },
  { id: 'criadoEm', tipo: 'date' },
]
