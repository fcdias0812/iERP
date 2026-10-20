import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataTableColumn } from '@/components/data-table'
import { SERVICOS } from '@/features/ordens/agendamento-schema'
import type { OrdemResumo } from '@/services/types'
import { STATUS_LOTE } from './origem'
import { rotuloDoStatus } from './status-do-lote'
import { StatusDoLote } from './StatusDoLote'

/** Número romano de cada serviço (I a V), como no formulário. */
const ROMANOS: Record<(typeof SERVICOS)[number], string> = {
  psm: 'I',
  onsiteShredding: 'II',
  recycleOnly: 'III',
  valueRecoveryRacks: 'IV',
  valueRecoveryItad: 'V',
}

/** Colunas da lista de lotes (Ordens › Lotes, Operação › Lotes e Operação › Recebimento). */
export function useColunasLotes(): DataTableColumn<OrdemResumo>[] {
  const { t } = useTranslation()
  return useMemo(() => {
    const texto = (
      id: keyof OrdemResumo,
      rotulo: string,
      size: number,
      extra: Partial<DataTableColumn<OrdemResumo>> = {},
    ): DataTableColumn<OrdemResumo> => ({
      id,
      header: t(`ordens.lotes.cols.${rotulo as 'site'}`),
      type: 'unique-text',
      accessor: (r) => r[id],
      size,
      ...extra,
    })
    const data = (
      id: 'dataColeta' | 'coletaPrevista' | 'dataChegada' | 'criadoEm',
      hidden = false,
    ) => ({
      id,
      header: t(`ordens.lotes.cols.${id}`),
      type: 'date' as const,
      accessor: (r: OrdemResumo) => r[id],
      size: 150,
      hidden,
    })
    return [
      texto('codigo', 'codigo', 130, {
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      }),
      texto('clienteNome', 'cliente', 220, {
        cell: (r) => <span className="font-medium">{r.clienteNome}</span>,
      }),
      texto('siteCodigo', 'site', 120, {
        cell: (r) => <span className="font-mono">{r.siteCodigo}</span>,
      }),
      texto('docaNumero', 'doca', 100, {
        cell: (r) => <span className="font-mono">{r.docaNumero}</span>,
      }),
      texto('referenciaCliente', 'referencia', 160, {
        cell: (r) => <span className="font-mono">{r.referenciaCliente ?? '—'}</span>,
      }),
      texto('transportadoraNome', 'transportadora', 200),
      data('dataColeta'),
      data('coletaPrevista'),
      data('dataChegada'),
      {
        id: 'servicos',
        header: t('ordens.lotes.cols.servicos'),
        type: 'unique-text',
        accessor: (r) =>
          SERVICOS.filter((s) => r.servicos[s])
            .map((s) => ROMANOS[s])
            .join(' · '),
        sortable: false,
        filterable: false,
        size: 140,
        exportValue: (r) =>
          SERVICOS.filter((s) => r.servicos[s])
            .map((s) => t(`ordens.agendamento.servicos.${s}`))
            .join('; '),
      },
      {
        id: 'totalVolumes',
        header: t('ordens.lotes.cols.totalVolumes'),
        type: 'number',
        accessor: (r) => r.totalVolumes,
        size: 120,
      },
      {
        id: 'rastrear',
        header: t('ordens.lotes.cols.rastrear'),
        type: 'boolean',
        accessor: (r) => r.rastrear,
        size: 130,
      },
      {
        id: 'status',
        header: t('ordens.lotes.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 170,
        mobile: 'badge',
        options: STATUS_LOTE.map((e) => ({ value: e, label: e })),
        // Processado lá fora (MoonShot): "Processamento 2/4 · Leitura das peças".
        cell: (r) => <StatusDoLote lote={r} size="sm" />,
        exportValue: (r) => rotuloDoStatus(t, r),
      },
      {
        id: 'recebidoEm',
        header: t('ordens.lotes.cols.recebidoEm'),
        type: 'date' as const,
        accessor: (r: OrdemResumo) => r.recebidoEm,
        size: 150,
        hidden: true,
      },
      data('criadoEm', true),
    ]
  }, [t])
}
