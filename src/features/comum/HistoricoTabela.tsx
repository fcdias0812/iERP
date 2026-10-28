import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { formatCnpj, formatCpf, formatDateTime, formatPhone } from '@/lib/format'
import type { StatusId } from '@/lib/status/statusMap'
import type {
  EventoAuditoria,
  EventoHistorico,
  EventoHistoricoModulo,
  Mudanca,
} from '@/services/types'

/*
 * Histórico como AUDITORIA (todos os cadastros): uma linha por campo alterado — data, quem,
 * ação, referência, campo, antes, depois — com filtros e exportação. Evento sem campo
 * (ex.: cadastro) vira uma linha só. Cada tela informa os rótulos de ações e campos.
 * Histórico de MÓDULO (vários registros): `registro` acrescenta as colunas do registro (ex.: Lote,
 * com link) e do cliente. AUDITORIA (o sistema inteiro): `registro.tipos` troca a coluna do
 * cliente pela do tipo do registro (cliente, lote, usuário…).
 */

/** Ordem inicial: do mais recente para o mais antigo. */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'em', desc: true }] }

/** O registro de uma linha (histórico de módulo / auditoria). */
export interface RegistroDaLinha {
  id: string
  rotulo: string
  tipo: string | null
  subtipo: string | null
}

interface Linha {
  id: string
  registroId: string | null
  tipo: string | null
  subtipo: string | null
  registroCodigo: string | null
  /** Lote excluído (27/10/2026): o código fica, sem link. */
  excluido: boolean
  clienteNome: string | null
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
  registro,
}: {
  id: string
  titulo: string
  historico: (EventoHistorico | EventoHistoricoModulo | EventoAuditoria)[]
  exportName: string
  /** Ações possíveis → rótulo. */
  acoes: Record<string, string>
  /** Campos possíveis → rótulo. */
  campos: Record<string, string>
  /** Formatação especial de um campo (o resto: sim/não, status, CNPJ, CPF, telefone, texto). */
  formatar?: (
    campo: string,
    valor: Mudanca['antes'],
    evento: EventoHistorico | EventoAuditoria,
  ) => string | undefined
  /** Histórico de módulo / auditoria: título da coluna do registro e o link para ele. */
  registro?: {
    titulo: string
    link: (r: RegistroDaLinha) => ReactNode
    /** Auditoria: coluna do tipo do registro (tipo → rótulo) no lugar da do cliente. */
    tipos?: Record<string, string>
  }
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)

  const linhas = useMemo<Linha[]>(() => {
    const valor = (
      campo: string,
      v: Mudanca['antes'],
      e: EventoHistorico | EventoAuditoria,
    ): string | null => {
      if (v === null || v === '') return null
      const especial = formatar?.(campo, v, e)
      if (especial !== undefined) return especial
      if (typeof v === 'boolean') return v ? t('dataTable.yes') : t('dataTable.no')
      if (campo === 'status') return t(`status.${v as StatusId}`)
      if (campo === 'cnpj') return formatCnpj(String(v))
      if (campo === 'cpf') return formatCpf(String(v))
      if (campo === 'telefone') return formatPhone(String(v))
      return String(v)
    }
    return historico.flatMap((e) => {
      const doModulo = 'registroCodigo' in e ? e : null
      const daAuditoria = 'tipo' in e ? e : null
      const base = {
        em: e.em,
        autor: e.autor,
        acao: e.acao as string,
        nota: e.nota ?? null,
        registroId: doModulo?.registroId ?? daAuditoria?.registroId ?? null,
        registroCodigo: doModulo?.registroCodigo ?? daAuditoria?.registroRotulo ?? null,
        excluido: Boolean(doModulo?.registroExcluido ?? daAuditoria?.registroExcluido),
        clienteNome: doModulo?.clienteNome ?? null,
        tipo: daAuditoria?.tipo ?? null,
        subtipo: daAuditoria?.registroSubtipo ?? null,
      }
      if (!e.mudancas?.length)
        return [{ ...base, id: e.id, campo: null, antes: null, depois: null }]
      return e.mudancas.map((m, i) => ({
        ...base,
        id: `${e.id}-${i}`,
        campo: m.campo in campos ? m.campo : null,
        antes: valor(m.campo, m.antes, e),
        depois: valor(m.campo, m.depois, e),
      }))
    })
  }, [historico, campos, formatar, t])

  const autores = useMemo(() => [...new Set(linhas.map((l) => l.autor))].sort(), [linhas])
  const clientes = useMemo(
    () => [...new Set(linhas.map((l) => l.clienteNome).filter(Boolean))].sort() as string[],
    [linhas],
  )

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
      ...(registro?.tipos
        ? ([
            {
              id: 'tipo',
              header: t('historico.cols.tipo'),
              type: 'enum',
              accessor: (r) => r.tipo,
              size: 150,
              options: Object.entries(registro.tipos).map(([value, label]) => ({ value, label })),
            },
          ] satisfies DataTableColumn<Linha>[])
        : []),
      ...(registro
        ? ([
            {
              id: 'registro',
              header: registro.titulo,
              type: 'unique-text',
              accessor: (r) => r.registroCodigo,
              size: registro.tipos ? 200 : 130,
              cell: (r) =>
                r.excluido && r.registroCodigo ? (
                  <span className="flex flex-col">
                    <span className="font-mono">{r.registroCodigo}</span>
                    <span className="type-caption text-muted-foreground">
                      {t('historico.excluido')}
                    </span>
                  </span>
                ) : r.registroId && r.registroCodigo ? (
                  registro.link({
                    id: r.registroId,
                    rotulo: r.registroCodigo,
                    tipo: r.tipo,
                    subtipo: r.subtipo,
                  })
                ) : (
                  '—'
                ),
            },
          ] satisfies DataTableColumn<Linha>[])
        : []),
      ...(registro && !registro.tipos
        ? ([
            {
              id: 'cliente',
              header: t('historico.cols.cliente'),
              type: 'enum',
              accessor: (r) => r.clienteNome,
              size: 200,
              options: clientes.map((c) => ({ value: c, label: c })),
            },
          ] satisfies DataTableColumn<Linha>[])
        : []),
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
    [t, autores, acoes, campos, registro, clientes],
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
