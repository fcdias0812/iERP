import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { formatCnpj, formatDateTime } from '@/lib/format'
import type { StatusId } from '@/lib/status/statusMap'
import type { Cliente, EventoHistorico, Mudanca, TipoDocumento } from '@/services/types'

/** Ordem inicial (sem ela, a tabela desempata pelo id interno). */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'em', desc: true }] }

/*
 * Histórico do cliente como AUDITORIA: uma linha por campo alterado (data, quem, ação, campo,
 * antes, depois, referência), com filtros e exportação. Evento sem campo (ex.: cadastro)
 * vira uma linha só.
 */

type Acao = EventoHistorico['acao']

const ACOES: Acao[] = [
  'criado',
  'editado',
  'status',
  'site_criado',
  'site_editado',
  'site_removido',
  'documento_adicionado',
  'documento_removido',
]

/** Campos que aparecem no histórico (chave = `clientes.historico.campos.<campo>`). */
const CAMPOS = [
  'nome',
  'cnpj',
  'contatos',
  'status',
  'codigo',
  'regiao',
  'horario',
  'totalGaylords',
  'cep',
  'endereco',
  'latitude',
  'longitude',
  'shredderProprio',
  'edgeSite',
  'responsavel',
  'contatoNovo',
  'docas',
  'tipoDocumento',
] as const
type Campo = (typeof CAMPOS)[number]

interface Linha {
  id: string
  em: string
  autor: string
  acao: Acao
  campo: Campo | null
  antes: string | null
  depois: string | null
  nota: string | null
}

export function AbaHistorico({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)

  /** Valor legível de um campo. */
  const valor = (campo: string, v: Mudanca['antes']): string | null => {
    if (v === null || v === '') return null
    if (typeof v === 'boolean') return v ? t('dataTable.yes') : t('dataTable.no')
    if (campo === 'status') return t(`status.${v as StatusId}`)
    if (campo === 'cnpj') return formatCnpj(String(v))
    if (campo === 'cep') return String(v).replace(/^(\d{5})(\d{3})$/, '$1-$2')
    if (campo === 'tipoDocumento') return t(`clientes.documentos.tipos.${v as TipoDocumento}`)
    return String(v)
  }

  const linhas = useMemo<Linha[]>(
    () =>
      c.historico.flatMap((e) => {
        const base = { em: e.em, autor: e.autor, acao: e.acao, nota: e.nota ?? null }
        if (!e.mudancas?.length)
          return [{ ...base, id: e.id, campo: null, antes: null, depois: null }]
        return e.mudancas.map((m, i) => ({
          ...base,
          id: `${e.id}-${i}`,
          campo: (CAMPOS as readonly string[]).includes(m.campo) ? (m.campo as Campo) : null,
          antes: valor(m.campo, m.antes),
          depois: valor(m.campo, m.depois),
        }))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `valor` só depende de `t`
    [c.historico, t],
  )

  const autores = useMemo(() => [...new Set(linhas.map((l) => l.autor))].sort(), [linhas])

  const colunas = useMemo<DataTableColumn<Linha>[]>(
    () => [
      {
        id: 'em',
        header: t('clientes.historico.cols.em'),
        type: 'date',
        accessor: (r) => r.em,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.em)}</span>,
        exportValue: (r) => formatDateTime(r.em),
      },
      {
        id: 'autor',
        header: t('clientes.historico.cols.autor'),
        type: 'enum',
        accessor: (r) => r.autor,
        size: 140,
        options: autores.map((a) => ({ value: a, label: a })),
      },
      {
        id: 'acao',
        header: t('clientes.historico.cols.acao'),
        type: 'enum',
        accessor: (r) => r.acao,
        size: 180,
        mobile: 'title',
        options: ACOES.map((a) => ({ value: a, label: t(`clientes.history.${a}`) })),
      },
      {
        id: 'nota',
        header: t('clientes.historico.cols.nota'),
        type: 'unique-text',
        accessor: (r) => r.nota,
        size: 170,
      },
      {
        id: 'campo',
        header: t('clientes.historico.cols.campo'),
        type: 'enum',
        accessor: (r) => r.campo,
        size: 160,
        options: CAMPOS.map((k) => ({ value: k, label: t(`clientes.historico.campos.${k}`) })),
      },
      {
        id: 'antes',
        header: t('clientes.historico.cols.antes'),
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
        header: t('clientes.historico.cols.depois'),
        type: 'unique-text',
        accessor: (r) => r.depois,
        size: 220,
        cell: (r) => (r.depois === null ? '—' : <span title={r.depois}>{r.depois}</span>),
      },
    ],
    [t, autores],
  )

  return (
    <DataTable
      id="cliente-historico"
      title={t('clientes.tabs.historico')}
      columns={colunas}
      getRowId={(r) => r.id}
      data={linhas}
      query={query}
      onQueryChange={setQuery}
      exportName={`historico-${c.codigo}`}
      empty={{ title: t('clientes.historico.vazio') }}
    />
  )
}
