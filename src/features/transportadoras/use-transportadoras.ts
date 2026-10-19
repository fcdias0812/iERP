import { useQuery } from '@tanstack/react-query'
import { criarHooksCadastro } from '@/features/comum/use-cadastro'
import { opcoesMotoristas } from '@/services/motoristas'
import {
  atualizarTransportadora,
  criarTransportadora,
  listarTransportadoras,
  obterTransportadora,
  resumoTransportadoras,
  transicionarTransportadora,
} from '@/services/transportadoras'
import type {
  PaginaTransportadoras,
  ResumoCadastro,
  Transportadora,
  TransportadoraInput,
} from '@/services/types'

/* Consultas e mutações de Transportadoras. */
export const transportadorasHooks = criarHooksCadastro<
  PaginaTransportadoras,
  ResumoCadastro,
  Transportadora,
  TransportadoraInput
>({
  raiz: 'transportadoras',
  listar: listarTransportadoras,
  resumo: resumoTransportadoras,
  obter: obterTransportadora,
  criar: criarTransportadora,
  atualizar: atualizarTransportadora,
  transicionar: transicionarTransportadora,
  nomeDe: (t) => t.nome,
  textos: 'transportadoras',
  errosDeCampo: ['cnpj_in_use', 'cpf_in_use'],
})

/** Motoristas para escolher na transportadora (a chave fica sob 'motoristas'). */
export const useOpcoesMotoristas = () =>
  useQuery({ queryKey: ['motoristas', 'opcoes'], queryFn: opcoesMotoristas })
