import { z } from 'zod'
import { limparTelefone, telefoneValido } from '../../shared/documentos.js'
import { REGIOES } from '../../shared/regioes.js'

/* Regras de Clientes › Logística: validação de sites e docas. */

export const MAX_DOCAS = 50

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)

/** Número opcional (vazio = null). */
const numeroOpcional = (s: z.ZodNumber) => s.nullish().transform((v) => v ?? null)

const docaSchema = z.object({
  numero: z.string().trim().min(1, 'Informe o número da doca.').max(20),
  alturaMaxCaminhao: z
    .number('Informe a altura máxima do caminhão.')
    .positive('Altura máxima do caminhão deve ser maior que zero.')
    .max(20),
  comprimentoMaxCaminhao: numeroOpcional(z.number().positive().max(40)),
  dockLeveler: z.boolean(),
  tailLift: z.boolean(),
  areaLift: numeroOpcional(z.number().min(0).max(10_000)),
  espaco: numeroOpcional(z.number().min(0).max(1_000_000)),
  altura: numeroOpcional(z.number().positive().max(100)),
  voltagemShredder: numeroOpcional(z.number().int().positive().max(1000)),
  pisoProtecaoObrigatorio: z.boolean(),
})

export const siteInputSchema = z
  .object({
    codigo: z.string().trim().min(1, 'Informe o código do site.').max(30),
    // Lista fechada (código); vazio = sem região.
    regiao: z
      .enum(REGIOES, 'Escolha uma região do Brasil.')
      .or(z.literal(''))
      .nullish()
      .transform((v) => v || null),
    horario: textoOpcional(120),
    totalGaylords: numeroOpcional(z.number().int().min(0).max(1_000_000)),
    cep: z
      .string()
      .nullish()
      .transform((v) => v?.replace(/\D/g, '') || null)
      .refine((v) => v === null || v.length === 8, 'CEP deve ter 8 dígitos.'),
    endereco: textoOpcional(300),
    latitude: numeroOpcional(z.number().min(-90).max(90)),
    longitude: numeroOpcional(z.number().min(-180).max(180)),
    shredderProprio: z.boolean(),
    edgeSite: z.boolean(),
    contatoId: z
      .string()
      .nullish()
      .transform((v) => v || null),
    novoContato: z
      .object({
        nome: textoOpcional(120),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email('E-mail do contato inválido.').max(160)),
        telefone: z
          .string()
          .transform(limparTelefone)
          .refine(telefoneValido, 'Telefone do contato inválido (DDD + número).'),
      })
      .nullish()
      .transform((v) => v ?? null),
    docas: z.array(docaSchema).max(MAX_DOCAS),
  })
  .refine((s) => (s.latitude === null) === (s.longitude === null), {
    message: 'Informe latitude e longitude juntas.',
    path: ['latitude'],
  })
  .refine((s) => !(s.contatoId && s.novoContato), {
    message: 'Escolha um contato existente OU cadastre um novo.',
    path: ['contatoId'],
  })
  .refine((s) => new Set(s.docas.map((d) => d.numero.toLowerCase())).size === s.docas.length, {
    message: 'Há docas com o mesmo número.',
    path: ['docas'],
  })

export type SiteDados = z.output<typeof siteInputSchema>
