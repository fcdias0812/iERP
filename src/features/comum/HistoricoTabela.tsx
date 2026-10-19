import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { formatCnpj, formatCpf, formatDateTime, formatPhone } from '@/lib/format'
import type { StatusId } from '@/lib/status/statusMap'
import type { EventoHistorico, Mudanca } from '@/services/types'

/*
 * Histórico como AUDITORIA (todos os cadastros): uma linha por campo alterado — data, quem,
 * ação, referência, campo, antes, depois — com filtros e exportação. Evento sem campo
 * (ex.: cadastro) vira uma linha só. Cada tela informa os rótulos de ações e campos.
 */

/** Ordem inicial: do mais recente para o mais antigo. */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'em', desc: true }] }

interface Linha {
  id: string
  em: string
  autor: string
  acao: string
  campo: string | null
  antes: string | null
  depois: string | null
  nota: string | null
}

export function HistoricoTabela({
  id,
  titulo,
  historico,
  exportName,
  acoes,
  campos,
  formatar,
}: {
  id: string
  titulo: string
  historico: EventoHistorico[]
  exportName: string
  /** Ações possíveis → rótulo. */
  acoes: Record<string, string>
  /** Campos possíveis → rótulo. */
  campos: Record<string, string>
  /** Formatação especial de um campo (o resto: sim/não, status, CNPJ, CPF, telefone, texto). */
  formatar?: (campo: string, valor: Mudanca['antes']) => string | undefined
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)

  const linhas = useMemo<Linha[]>(() => {
    const valor = (campo: string, v: Mudanca['antes']): string | null => {
      if (v === null || v === '') return null
      const especial = formatar?.(campo, v)
      if (especial !== undefined) return especial
      if (typeof v === 'boolean') return v ? t('dataTable.yes') : t('dataTable.no')
      if (campo === 'status') return t(`status.${v as StatusId}`)
      if (campo === 'cnpj') return formatCnpj(String(v))
      if (campo === 'cpf') return formatCpf(String(v))
      if (campo === 'telefone') return formatPhone(String(v))
      return String(v)
    }
    return historico.flatMap((e) => {
      const base = { em: e.em, autor: e.autor, acao: e.acao as string, nota: e.nota ?? null }
      if (!e.mudancas?.length)
        return [{ ...base, id: e.id, campo: null, antes: null, depois: null }]
      return e.mudancas.map((m, i) => ({
        ...base,
        id: `${e.id}-${i}`,
        campo: m.campo in campos ? m.campo : null,
        antes: valor(m.campo, m.antes),
        depois: valor(m.campo, m.depois),
      }))
    })
  }, [historico, campos, formatar, t])

  const autores = useMemo(() => [...new Set(linhas.map((l) => l.autor))].sort(), [linhas])

  const colunas = useMemo<DataTableColumn<Linha>[]>(
    () => [
      {
        id: 'em',
        header: t('historico.cols.em'),
        type: 'date',
        accessor: (r) => r.em,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.em)}</span>,
        exportValue: (r) => formatDateTime(r.em),
      },
      {
        id: 'autor',
        header: t('historico.cols.autor'),
        type: 'enum',
        accessor: (r) => r.autor,
        size: 140,
        options: autores.map((a) => ({ value: a, label: a })),
      },
      {
        id: 'acao',
        header: t('historico.cols.acao'),
        type: 'enum',
        accessor: (r) => r.acao,
        size: 180,
        mobile: 'title',
        options: Object.entries(acoes).map(([value, label]) => ({ value, label })),
      },
      {
        id: 'nota',
        header: t('historico.cols.nota'),
        type: 'unique-text',
        accessor: (r) => r.nota,
        size: 170,
      },
      {
        id: 'campo',
        header: t('historico.cols.campo'),
        type: 'enum',
        accessor: (r) => r.campo,
        size: 160,
        options: Object.entries(campos).map(([value, label]) => ({ value, label })),
      },
      {
        id: 'antes',
        header: t('historico.cols.antes'),
        type: 'unique-text',
        accessor: (r) => r.antes,
        size: 220,
        cell: (r) =>
          r.antes === null ? (
            '—'
          ) : (
            <span className="text-muted-foreground line-through" title={r.antes}>
              {r.antes}
            </span>
          ),
      },
      {
        id: 'depois',
        header: t('historico.cols.depois'),
        type: 'unique-text',
        accessor: (r) => r.depois,
        size: 220,
        cell: (r) => (r.depois === null ? '—' : <span title={r.depois}>{r.depois}</span>),
      },
    ],
    [t, autores, acoes, campos],
  )

  return (
    <DataTable
      id={id}
      title={titulo}
      columns={colunas}
      getRowId={(r) => r.id}
      data={linhas}
      query={query}
      onQueryChange={setQuery}
      exportName={exportName}
      empty={{ title: t('historico.vazio') }}
    />
  )
}
