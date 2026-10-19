import { isValidPhone } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'

/*
 * Contatos (nome, e-mail, telefone) de um cadastro — Clientes e Transportadoras.
 * No formulário, o PRIMEIRO da lista é o principal. Telefone sem pontuação (MaskedInput).
 */

export const MAX_CONTATOS = 20

export const contatoSchema = z.object({
  /** Contato já salvo (null = novo). Mantém o vínculo com outros registros. */
  id: z.string().nullable(),
  nome: z.string().trim().max(120),
  email: z.email().max(160),
  telefone: z.string().refine(isValidPhone, 'validation.phone'),
})

export type ContatoForm = z.input<typeof contatoSchema>

export const contatoVazio = (): ContatoForm => ({ id: null, nome: '', email: '', telefone: '' })

/** Contato salvo → formulário (o principal vai para o topo). */
export const contatosParaForm = (
  l: { id: string; nome: string | null; email: string; telefone: string; principal: boolean }[],
): ContatoForm[] =>
  [...l]
    .sort((a, b) => Number(b.principal) - Number(a.principal))
    .map((k) => ({ id: k.id, nome: k.nome ?? '', email: k.email, telefone: k.telefone }))

/** Formulário → API (o primeiro é o principal). */
export const contatosParaInput = (l: z.output<typeof contatoSchema>[]) =>
  l.map((k, i) => ({
    id: k.id,
    nome: k.nome.trim() || null,
    email: k.email.trim().toLowerCase(),
    telefone: k.telefone,
    principal: i === 0,
  }))
