import { isValidPhone } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import type { Doca, RegiaoBrasil, SiteCliente, SiteInput } from '@/services/types'

/*
 * Formulário do site (Clientes › Logística). Mesmas regras do servidor
 * (server/src/modules/clientes/clientes-sites.regras.ts).
 * Responsável: NENHUM · id de um contato do cliente · NOVO_CONTATO = cadastrar agora.
 */

export const NENHUM = '__nenhum'
export const NOVO_CONTATO = '__novo'
export const MAX_DOCAS = 50

/** "lat, long" → números (ou null se vazio). Inválido → undefined. */
export function lerCoordenadas(texto: string): { lat: number; lng: number } | null | undefined {
  const t = texto.trim()
  if (!t) return null
  const m = /^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/.exec(t)
  if (!m) return undefined
  const lat = Number(m[1]!.replace(',', '.'))
  const lng = Number(m[2]!.replace(',', '.'))
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined
  return { lat, lng }
}

export const escreverCoordenadas = (lat: number, lng: number) =>
  `${lat.toFixed(6)}, ${lng.toFixed(6)}`

/** Número opcional (vazio = null). */
const opcional = (s: z.ZodNumber) => s.nullable()

const docaSchema = z.object({
  numero: z.string().trim().min(1).max(20),
  alturaMaxCaminhao: z.number({ error: 'validation.required' }).positive().max(20),
  comprimentoMaxCaminhao: opcional(z.number().positive().max(40)),
  dockLeveler: z.boolean(),
  tailLift: z.boolean(),
  areaLift: opcional(z.number().min(0).max(10_000)),
  espaco: opcional(z.number().min(0).max(1_000_000)),
  altura: opcional(z.number().positive().max(100)),
  voltagemShredder: opcional(z.number().int().positive().max(1000)),
  pisoProtecaoObrigatorio: z.boolean(),
})

export const siteSchema = z
  .object({
    codigo: z.string().trim().min(1).max(30),
    /** Código da região ou NENHUM. */
    regiao: z.string(),
    horario: z.string().trim().max(120),
    totalGaylords: opcional(z.number().int().min(0).max(1_000_000)),
    cep: z.string().refine((v) => v === '' || v.replace(/\D/g, '').length === 8, 'validation.cep'),
    endereco: z.string().trim().max(300),
    coordenadas: z
      .string()
      .refine((v) => lerCoordenadas(v) !== undefined, 'validation.coordinates'),
    shredderProprio: z.boolean(),
    edgeSite: z.boolean(),
    responsavel: z.string(),
    novoContato: z.object({
      nome: z.string().trim().max(120),
      email: z.string().trim().max(160),
      telefone: z.string(),
    }),
    docas: z.array(docaSchema).max(MAX_DOCAS),
  })
  .superRefine((v, ctx) => {
    // Contato novo: e-mail e telefone obrigatórios (como em Contatos).
    if (v.responsavel === NOVO_CONTATO) {
      if (!z.email().safeParse(v.novoContato.email).success)
        ctx.addIssue({
          code: 'custom',
          path: ['novoContato', 'email'],
          message: v.novoContato.email ? 'validation.email' : 'validation.required',
        })
      if (!isValidPhone(v.novoContato.telefone))
        ctx.addIssue({
          code: 'custom',
          path: ['novoContato', 'telefone'],
          message: v.novoContato.telefone ? 'validation.phone' : 'validation.required',
        })
    }
    // Número da doca não repete dentro do site.
    const vistos = new Set<string>()
    v.docas.forEach((d, i) => {
      const k = d.numero.trim().toLowerCase()
      if (k && vistos.has(k))
        ctx.addIssue({
          code: 'custom',
          path: ['docas', i, 'numero'],
          message: 'validation.duplicate',
        })
      vistos.add(k)
    })
  })

export type SiteForm = z.input<typeof siteSchema>
export type DocaForm = SiteForm['docas'][number]

export const docaVazia = (): DocaForm => ({
  numero: '',
  alturaMaxCaminhao: null as unknown as number,
  comprimentoMaxCaminhao: null,
  dockLeveler: false,
  tailLift: false,
  areaLift: null,
  espaco: null,
  altura: null,
  voltagemShredder: null,
  pisoProtecaoObrigatorio: false,
})

export const novoSiteForm = (): SiteForm => ({
  codigo: '',
  regiao: NENHUM,
  horario: '',
  totalGaylords: null,
  cep: '',
  endereco: '',
  coordenadas: '',
  shredderProprio: false,
  edgeSite: false,
  responsavel: NENHUM,
  novoContato: { nome: '', email: '', telefone: '' },
  docas: [],
})

export const siteParaForm = (s: SiteCliente): SiteForm => ({
  codigo: s.codigo,
  regiao: s.regiao ?? NENHUM,
  horario: s.horario ?? '',
  totalGaylords: s.totalGaylords,
  cep: s.cep ?? '',
  endereco: s.endereco ?? '',
  coordenadas:
    s.latitude !== null && s.longitude !== null ? escreverCoordenadas(s.latitude, s.longitude) : '',
  shredderProprio: s.shredderProprio,
  edgeSite: s.edgeSite,
  responsavel: s.responsavel?.id ?? NENHUM,
  novoContato: { nome: '', email: '', telefone: '' },
  docas: s.docas.map((d: Doca) => ({
    numero: d.numero,
    alturaMaxCaminhao: d.alturaMaxCaminhao,
    comprimentoMaxCaminhao: d.comprimentoMaxCaminhao,
    dockLeveler: d.dockLeveler,
    tailLift: d.tailLift,
    areaLift: d.areaLift,
    espaco: d.espaco,
    altura: d.altura,
    voltagemShredder: d.voltagemShredder,
    pisoProtecaoObrigatorio: d.pisoProtecaoObrigatorio,
  })),
})

export function formParaInput(v: z.output<typeof siteSchema>): SiteInput {
  const coord = lerCoordenadas(v.coordenadas) ?? null
  const novo = v.responsavel === NOVO_CONTATO
  return {
    codigo: v.codigo.trim(),
    regiao: v.regiao === NENHUM ? null : (v.regiao as RegiaoBrasil),
    horario: v.horario.trim() || null,
    totalGaylords: v.totalGaylords,
    cep: v.cep.replace(/\D/g, '') || null,
    endereco: v.endereco.trim() || null,
    latitude: coord?.lat ?? null,
    longitude: coord?.lng ?? null,
    shredderProprio: v.shredderProprio,
    edgeSite: v.edgeSite,
    contatoId: !novo && v.responsavel !== NENHUM ? v.responsavel : null,
    novoContato: novo
      ? {
          nome: v.novoContato.nome.trim() || null,
          email: v.novoContato.email.trim().toLowerCase(),
          telefone: v.novoContato.telefone,
        }
      : null,
    docas: v.docas.map((d) => ({ ...d, numero: d.numero.trim() })),
  }
}
