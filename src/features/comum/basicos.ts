import { z } from '@/lib/zod-i18n'
import { isValidCnpj, isValidCpf, isValidPhone } from '@/lib/validators/br'

/*
 * Inclusão rápida de transportadora e de motorista ("não está na lista? cadastre agora") —
 * mesmas regras do servidor (server/src/modules/relacionamento.basico.ts).
 */

export const transportadoraBasicaSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  cnpj: z.string().min(1).refine(isValidCnpj, 'validation.cnpj'),
})

export const motoristaBasicoSchema = z.object({
  nome: z.string().trim().min(3).max(160),
  cpf: z.string().min(1).refine(isValidCpf, 'validation.cpf'),
  telefone: z.string().min(1).refine(isValidPhone, 'validation.phone'),
})

export type TransportadoraBasica = z.input<typeof transportadoraBasicaSchema>
export type MotoristaBasico = z.input<typeof motoristaBasicoSchema>

export const transportadoraBasicaVazia = (): TransportadoraBasica => ({ nome: '', cnpj: '' })
export const motoristaBasicoVazio = (): MotoristaBasico => ({ nome: '', cpf: '', telefone: '' })
