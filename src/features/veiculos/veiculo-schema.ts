import { z } from '@/lib/zod-i18n'
import type { TipoVeiculo, Veiculo, VeiculoInput } from '@/services/types'

/* Formulário do veículo. Mesmas regras do servidor (server/src/modules/veiculos/veiculos.ts). */

export const TIPOS_VEICULO: TipoVeiculo[] = ['truck', 'carreta', 'van']

const medida = (max: number) => z.number().min(0).max(max).nullable()

export const veiculoSchema = z
  .object({
    tipo: z.enum(['truck', 'carreta', 'van'], { error: 'validation.required' }),
    // Quantidade de volumes (pallets + gaylords + racks): faixa do cálculo da OS.
    volumeMinimo: z.number().int().min(0).max(10_000).nullable(),
    volumeMaximo: z.number().int().min(0).max(10_000).nullable(),
    comprimento: medida(50),
    largura: medida(10),
    capacidadePallets: z.number().int().min(0).max(1000).nullable(),
    capacidadeToneladas: medida(200),
  })
  .refine(
    (v) => v.volumeMinimo === null || v.volumeMaximo === null || v.volumeMinimo <= v.volumeMaximo,
    { message: 'validation.volumeOrder', path: ['volumeMinimo'] },
  )

export type VeiculoForm = z.input<typeof veiculoSchema>

export const novoVeiculoForm = (): VeiculoForm => ({
  tipo: undefined as unknown as TipoVeiculo,
  volumeMinimo: null,
  volumeMaximo: null,
  comprimento: null,
  largura: null,
  capacidadePallets: null,
  capacidadeToneladas: null,
})

export const veiculoParaForm = (v: Veiculo): VeiculoForm => ({
  tipo: v.tipo,
  volumeMinimo: v.volumeMinimo,
  volumeMaximo: v.volumeMaximo,
  comprimento: v.comprimento,
  largura: v.largura,
  capacidadePallets: v.capacidadePallets,
  capacidadeToneladas: v.capacidadeToneladas,
})

export const formParaInput = (v: z.output<typeof veiculoSchema>): VeiculoInput => ({ ...v })
