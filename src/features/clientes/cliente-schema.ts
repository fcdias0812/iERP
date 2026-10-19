import { isValidCnpj, isValidPhone } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import type { Cliente, ClienteInput } from '@/services/types'
import { MAX_CONTATOS } from './fluxo'

/*
 * Formulário do cliente. CNPJ e telefone ficam SEM pontuação no formulário (o MaskedInput
 * entrega o valor limpo). O primeiro contato da lista é o principal.
 */

const contatoSchema = z.object({
  /** Contato já salvo (null = novo). Mantém o vínculo, ex.: responsável por um site. */
  id: z.string().nullable(),
  nome: z.string().trim().max(120),
  email: z.email().max(160),
  telefone: z.string().refine(isValidPhone, 'validation.phone'),
})

export const clienteSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  cnpj: z.string().min(1).refine(isValidCnpj, 'validation.cnpj'),
  contatos: z.array(contatoSchema).min(1).max(MAX_CONTATOS),
})

export type ClienteForm = z.input<typeof clienteSchema>
export type ContatoForm = ClienteForm['contatos'][number]

export const contatoVazio = (): ContatoForm => ({ id: null, nome: '', email: '', telefone: '' })

export const novoClienteForm = (): ClienteForm => ({
  nome: '',
  cnpj: '',
  contatos: [contatoVazio()],
})

export const clienteParaForm = (c: Cliente): ClienteForm => ({
  nome: c.nome,
  cnpj: c.cnpj,
  // O principal primeiro (a API já devolve assim; garantimos).
  contatos: [...c.contatos]
    .sort((a, b) => Number(b.principal) - Number(a.principal))
    .map((k) => ({ id: k.id, nome: k.nome ?? '', email: k.email, telefone: k.telefone })),
})

export const formParaInput = (v: z.output<typeof clienteSchema>): ClienteInput => ({
  nome: v.nome.trim(),
  cnpj: v.cnpj.toUpperCase(),
  contatos: v.contatos.map((k, i) => ({
    id: k.id,
    nome: k.nome.trim() || null,
    email: k.email.trim().toLowerCase(),
    telefone: k.telefone,
    principal: i === 0,
  })),
})
