import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HistoricoTabela, type RegistroDaLinha } from '@/features/comum/HistoricoTabela'
import { useRotulosHistoricoLote } from '@/features/lotes/historico-lote'
import { apiErrorMessage } from '@/lib/api-errors'
import { historicoKeys, listarHistoricoModulo } from '@/services/historico'
import type { EventoHistoricoModulo, ModuloHistorico } from '@/services/types'
import { desdeDo, type Periodo } from './periodo'
import { SeletorPeriodo } from './SeletorPeriodo'

/*
 * Histórico do MÓDULO (Ordens › Histórico e Operação › Histórico — pedido do usuário): a mesma
 * auditoria em tabela dos registros, de todos os lotes do módulo, com a coluna do lote (abre o
 * lote no próprio módulo) e do cliente. O servidor já filtra o que é de cada módulo.
 * Período carregado: ver `SeletorPeriodo`.
 */

/** Ações que aparecem em cada módulo (as mesmas do servidor). */
const ACOES_DO_MODULO: Record<ModuloHistorico, string[]> = {
  ordens: [
    'criado',
    'editado',
    'documento_adicionado',
    'documento_removido',
    'viagem_adicionada',
    'rastreador_adicionado',
    'juntado',
    'coleta_juntada',
    'separado',
    'lote_excluido',
    'juntado_excluido',
    'viagem_iniciada',
    'viagem_chegou',
    'viagem_finalizada',
    'viagem_cancelada',
    'viagem_emergencia',
    'viagem_emergencia_ciente',
    'ocorrencia_registrada',
    'ocorrencia_editada',
    'ocorrencia_cancelada',
  ],
  operacao: [
    'criado',
    'lote_excluido',
    'recebido',
    'recebimento_editado',
    'status',
    'processamento',
    'devolucao_pedida',
    'devolucao_cancelada',
    'ocorrencia_registrada',
    'ocorrencia_editada',
    'ocorrencia_cancelada',
  ],
}

const SEM_EVENTOS: EventoHistoricoModulo[] = []

export function HistoricoModuloPage({ modulo }: { modulo: ModuloHistorico }) {
  return (
    <RequirePermission permission={`${modulo}.historico.ver`}>
      <Historico modulo={modulo} />
    </RequirePermission>
  )
}

function Historico({ modulo }: { modulo: ModuloHistorico }) {
  const { t } = useTranslation()
  const [periodo, setPeriodo] = useState<Periodo>('90')
  // O início do período é fixado ao escolher (não muda a cada render).
  const desde = useMemo(() => desdeDo(periodo), [periodo])
  const consulta = useQuery({
    queryKey: historicoKeys.modulo(modulo, desde),
    queryFn: ({ signal }) => listarHistoricoModulo(modulo, desde, signal),
  })
  const rotulos = useRotulosHistoricoLote()
  const acoes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(rotulos.acoes).filter(([a]) => ACOES_DO_MODULO[modulo].includes(a)),
      ),
    [rotulos.acoes, modulo],
  )
  const registro = useMemo(
    () => ({
      titulo: t('historico.cols.lote'),
      link: ({ id, rotulo: codigo }: RegistroDaLinha) =>
        modulo === 'ordens' ? (
          <Link
            to="/ordens/lotes/$id"
            params={{ id }}
            search={{ aba: 'historico' }}
            className="font-mono text-link underline-offset-4 hover:underline"
          >
            {codigo}
          </Link>
        ) : (
          <Link
            to="/operacao/lotes/$id"
            params={{ id }}
            search={{ aba: 'historico' }}
            className="font-mono text-link underline-offset-4 hover:underline"
          >
            {codigo}
          </Link>
        ),
    }),
    [t, modulo],
  )

  return (
    <ListPage title={t(`nav.${modulo}.historico`)} description={t(`historicoModulo.${modulo}`)}>
      <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
      {consulta.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : consulta.isError ? (
        <Alert
          tone="danger"
          title={t('historicoModulo.erro')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void consulta.refetch()}>
              {t('common.tryAgain')}
            </Button>
          }
        >
          {apiErrorMessage(consulta.error)}
        </Alert>
      ) : (
        <HistoricoTabela
          id={`historico-${modulo}`}
          titulo={t(`nav.${modulo}.historico`)}
          historico={consulta.data ?? SEM_EVENTOS}
          exportName={`historico-${modulo}`}
          acoes={acoes}
          campos={rotulos.campos}
          formatar={rotulos.formatar}
          registro={registro}
        />
      )}
    </ListPage>
  )
}
