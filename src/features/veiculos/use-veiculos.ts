import { criarHooksCadastro } from '@/features/comum/use-cadastro'
import type { PaginaVeiculos, ResumoCadastro, VeiculoDetalhe, VeiculoInput } from '@/services/types'
import {
  atualizarVeiculo,
  criarVeiculo,
  listarVeiculos,
  obterVeiculo,
  resumoVeiculos,
  transicionarVeiculo,
} from '@/services/veiculos'

/* Consultas e mutações de Veículos. */
export const veiculosHooks = criarHooksCadastro<
  PaginaVeiculos,
  ResumoCadastro,
  VeiculoDetalhe,
  VeiculoInput
>({
  raiz: 'veiculos',
  listar: listarVeiculos,
  resumo: resumoVeiculos,
  obter: obterVeiculo,
  criar: criarVeiculo,
  atualizar: atualizarVeiculo,
  transicionar: transicionarVeiculo,
  nomeDe: (v) => v.codigo,
  textos: 'veiculos',
})
