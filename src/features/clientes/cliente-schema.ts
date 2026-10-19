import { isValidCnpj } from '@/lib/validators/br'
import {
  contatoSchema,
  contatosParaForm,
  contatosParaInput,
  contatoVazio,
  MAX_CONTATOS,
} from '@/features/comum/contatos'
import { z } from '@/lib/zod-i18n'
import type { Cliente, ClienteInput } from '@/services/types'

/*
 * Formulário do cliente. CNPJ e telefone ficam SEM pontuação no formulário (o MaskedInput
 * entrega o valor limpo). O primeiro contato da lista é o principal.
 */

export const clienteSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  cnpj: z.string().min(1).refine(isValidCnpj, 'validation.cnpj'),
  /** SLA em dias (opcional). */
  slaDias: z.number().int().min(1).max(3650).nullable(),
  contatos: z.array(contatoSchema).min(1).max(MAX_CONTATOS),
})

export type ClienteForm = z.input<typeof clienteSchema>

export const novoClienteForm = (): ClienteForm => ({
  nome: '',
  cnpj: '',
  slaDias: null,
  contatos: [contatoVazio()],
})

export const clienteParaForm = (c: Cliente): ClienteForm => ({
  nome: c.nome,
  cnpj: c.cnpj,
  slaDias: c.slaDias,
  // O principal primeiro.
  contatos: contatosParaForm(c.contatos),
})

export const formParaInput = (v: z.output<typeof clienteSchema>): ClienteInput => ({
  nome: v.nome.trim(),
  cnpj: v.cnpj.toUpperCase(),
  slaDias: v.slaDias,
  contatos: contatosParaInput(v.contatos),
})
