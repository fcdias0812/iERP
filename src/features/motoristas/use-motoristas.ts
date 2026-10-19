import { useQuery } from '@tanstack/react-query'
import { criarHooksCadastro } from '@/features/comum/use-cadastro'
import {
  atualizarMotorista,
  criarMotorista,
  listarMotoristas,
  obterMotorista,
  resumoMotoristas,
  transicionarMotorista,
} from '@/services/motoristas'
import { opcoesTransportadoras } from '@/services/transportadoras'
import type {
  Motorista,
  MotoristaInput,
  PaginaMotoristas,
  ResumoMotoristas,
} from '@/services/types'

/* Consultas e mutações de Motoristas. */
export const motoristasHooks = criarHooksCadastro<
  PaginaMotoristas,
  ResumoMotoristas,
  Motorista,
  MotoristaInput
>({
  raiz: 'motoristas',
  listar: listarMotoristas,
  resumo: resumoMotoristas,
  obter: obterMotorista,
  criar: criarMotorista,
  atualizar: atualizarMotorista,
  transicionar: transicionarMotorista,
  nomeDe: (m) => m.nome,
  textos: 'motoristas',
  errosDeCampo: ['cpf_in_use', 'cnpj_in_use'],
})

/** Transportadoras para escolher no motorista (a chave fica sob 'transportadoras'). */
export const useOpcoesTransportadoras = () =>
  useQuery({ queryKey: ['transportadoras', 'opcoes'], queryFn: opcoesTransportadoras })
