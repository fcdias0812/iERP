import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Badge } from '@/components/ui/badge'
import { formatPhone } from '@/lib/format'

/* Contatos de um cadastro (Clientes, Transportadoras): o principal SEMPRE em primeiro e destacado. */

interface Contato {
  id: string
  nome: string | null
  email: string
  telefone: string
  principal: boolean
}

/** Ordem inicial (sem ela, a tabela desempata pelo id interno). */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }
const ehPrincipal = (k: Contato) => k.principal

export function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="break-all text-link underline-offset-4 hover:underline">
      {email}
    </a>
  )
}

export function ContatosTabela({
  id,
  titulo,
  contatos,
  exportName,
  toolbar,
}: {
  id: string
  titulo: string
  contatos: Contato[]
  exportName: string
  toolbar?: ReactNode
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)

  const colunas = useMemo<DataTableColumn<Contato>[]>(
    () => [
      {
        id: 'nome',
        header: t('contatos.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 240,
        mobile: 'title',
        cell: (r) => (
          <span className="flex items-center gap-2">
            <span className="truncate">{r.nome ?? '—'}</span>
            {r.principal && (
              <Badge variant="info">
                <Star aria-hidden />
                {t('contatos.principal')}
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'email',
        header: t('contatos.email'),
        type: 'unique-text',
        accessor: (r) => r.email,
        size: 300,
        cell: (r) => <EmailLink email={r.email} />,
      },
      {
        id: 'telefone',
        header: t('contatos.telefone'),
        type: 'unique-text',
        accessor: (r) => r.telefone,
        size: 170,
        cell: (r) => <span className="num">{formatPhone(r.telefone)}</span>,
        exportValue: (r) => formatPhone(r.telefone),
      },
      {
        id: 'principal',
        header: t('contatos.principal'),
        type: 'boolean',
        accessor: (r) => r.principal,
        size: 120,
        hidden: true,
      },
    ],
    [t],
  )

  return (
    <DataTable
      id={id}
      title={titulo}
      columns={colunas}
      getRowId={(r) => r.id}
      data={contatos}
      query={query}
      onQueryChange={setQuery}
      pinTop={ehPrincipal}
      highlightRow={ehPrincipal}
      exportName={exportName}
      toolbar={toolbar}
      empty={{ title: t('contatos.nenhum') }}
    />
  )
}
