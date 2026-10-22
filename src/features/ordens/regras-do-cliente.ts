import { useEffect, useRef } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { useCliente } from '@/features/clientes/use-clientes'
import type { ConfiguracoesCliente } from '@/services/types'
import { NENHUM, novoAgendamento, type AgendamentoForm } from './agendamento-schema'

/*
 * A aba Configurações do cliente no Agendamento (22/10/2026): as regras do cliente escolhido e,
 * ao escolher o cliente, os padrões dele (rastreio, serviços e transportadora).
 */

/** As configurações do cliente escolhido no formulário (undefined enquanto carrega ou sem cliente). */
export function useRegrasDoCliente(form: UseFormReturn<AgendamentoForm>) {
  const clienteId = useWatch({ control: form.control, name: 'clienteId' })
  return useCliente(clienteId || undefined).data?.configuracoes
}

/**
 * Agendamento novo: escolheu o cliente → aplica uma vez os padrões dele. Sem serviços padrão,
 * volta aos do sistema; a transportadora padrão do cliente anterior sai se ninguém a trocou.
 */
export function useAplicarPadroesDoCliente(
  form: UseFormReturn<AgendamentoForm>,
  regras: ConfiguracoesCliente | undefined,
) {
  const clienteId = useWatch({ control: form.control, name: 'clienteId' })
  const aplicadoPara = useRef<string | null>(null)
  const anterior = useRef<ConfiguracoesCliente | undefined>(undefined)
  useEffect(() => {
    if (!clienteId || !regras || aplicadoPara.current === clienteId) return
    aplicadoPara.current = clienteId
    const opcoes = { shouldDirty: true }
    form.setValue('rastrear', regras.rastrearColeta, opcoes)
    form.setValue('servicos', regras.servicosPadrao ?? novoAgendamento().servicos, opcoes)
    const atual = form.getValues('transportadoraId')
    if (regras.transportadoraPadraoId)
      form.setValue('transportadoraId', regras.transportadoraPadraoId, opcoes)
    else if (
      anterior.current?.transportadoraPadraoId &&
      atual === anterior.current.transportadoraPadraoId
    )
      form.setValue('transportadoraId', NENHUM, opcoes)
    anterior.current = regras
  }, [clienteId, regras, form])
}
