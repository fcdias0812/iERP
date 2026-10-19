import { motoristaBasicoSchema, transportadoraBasicaSchema } from '@/features/comum/basicos'
import {
  contatoSchema,
  contatosParaForm,
  contatosParaInput,
  MAX_CONTATOS,
} from '@/features/comum/contatos'
import { z } from '@/lib/zod-i18n'
import type { Transportadora, TransportadoraInput } from '@/services/types'

/*
 * Formulário da transportadora. Contatos são opcionais (se houver, o primeiro é o principal).
 * Motoristas: os da lista (`vinculados`) e os cadastrados agora (`novosMotoristas`), que também
 * entram em Motoristas. Quem sair da lista fica sem transportadora.
 */

export const MAX_MOTORISTAS_NOVOS = 50

export const transportadoraSchema = transportadoraBasicaSchema.extend({
  contatos: z.array(contatoSchema).max(MAX_CONTATOS),
  /** Motoristas já cadastrados (nome/CPF só para exibir). */
  vinculados: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      cpf: z.string(),
      transportadoraNome: z.string().nullable(),
    }),
  ),
  novosMotoristas: z.array(motoristaBasicoSchema).max(MAX_MOTORISTAS_NOVOS),
})

export type TransportadoraForm = z.input<typeof transportadoraSchema>
export type MotoristaVinculado = TransportadoraForm['vinculados'][number]

export const novaTransportadoraForm = (): TransportadoraForm => ({
  nome: '',
  cnpj: '',
  contatos: [],
  vinculados: [],
  novosMotoristas: [],
})

export const transportadoraParaForm = (t: Transportadora): TransportadoraForm => ({
  nome: t.nome,
  cnpj: t.cnpj,
  contatos: contatosParaForm(t.contatos),
  vinculados: t.motoristas.map((m) => ({
    id: m.id,
    nome: m.nome,
    cpf: m.cpf,
    transportadoraNome: null, // já são desta transportadora
  })),
  novosMotoristas: [],
})

export const formParaInput = (v: z.output<typeof transportadoraSchema>): TransportadoraInput => ({
  nome: v.nome.trim(),
  cnpj: v.cnpj.toUpperCase(),
  contatos: contatosParaInput(v.contatos),
  motoristas: [
    ...v.vinculados.map((m) => ({ id: m.id })),
    ...v.novosMotoristas.map((m) => ({ novo: { nome: m.nome, cpf: m.cpf, telefone: m.telefone } })),
  ],
})
