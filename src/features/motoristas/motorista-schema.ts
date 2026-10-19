import { z } from '@/lib/zod-i18n'
import { motoristaBasicoSchema, transportadoraBasicaSchema } from '@/features/comum/basicos'
import type { Motorista, MotoristaInput } from '@/services/types'

/* Formulário do motorista. Mesmas regras do servidor (server/src/modules/motoristas/). */

/** Transportadora: SEM (nenhuma) · id de uma existente · NOVA = cadastrar agora. */
export const SEM_TRANSPORTADORA = '__sem'
export const NOVA_TRANSPORTADORA = '__nova'

export const motoristaSchema = motoristaBasicoSchema
  .extend({
    transportadora: z.string(),
    novaTransportadora: z.object({ nome: z.string(), cnpj: z.string() }),
  })
  .superRefine((v, ctx) => {
    if (v.transportadora !== NOVA_TRANSPORTADORA) return
    const r = transportadoraBasicaSchema.safeParse(v.novaTransportadora)
    if (r.success) return
    for (const issue of r.error.issues)
      ctx.addIssue({
        code: 'custom',
        path: ['novaTransportadora', ...issue.path],
        message:
          issue.path[0] === 'cnpj' && v.novaTransportadora.cnpj
            ? 'validation.cnpj'
            : 'validation.required',
      })
  })

export type MotoristaForm = z.input<typeof motoristaSchema>

export const novoMotoristaForm = (): MotoristaForm => ({
  nome: '',
  cpf: '',
  telefone: '',
  transportadora: SEM_TRANSPORTADORA,
  novaTransportadora: { nome: '', cnpj: '' },
})

export const motoristaParaForm = (m: Motorista): MotoristaForm => ({
  nome: m.nome,
  cpf: m.cpf,
  telefone: m.telefone,
  transportadora: m.transportadoraId ?? SEM_TRANSPORTADORA,
  novaTransportadora: { nome: '', cnpj: '' },
})

export const formParaInput = (v: z.output<typeof motoristaSchema>): MotoristaInput => {
  const nova = v.transportadora === NOVA_TRANSPORTADORA
  return {
    nome: v.nome,
    cpf: v.cpf,
    telefone: v.telefone,
    transportadoraId: nova || v.transportadora === SEM_TRANSPORTADORA ? null : v.transportadora,
    novaTransportadora: nova
      ? {
          nome: v.novaTransportadora.nome.trim(),
          cnpj: v.novaTransportadora.cnpj.toUpperCase(),
        }
      : null,
  }
}
