import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Star } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'
import type { Cliente, ContatoCliente } from '@/services/types'
import { EmailLink } from './comum'

/** Ordem inicial (sem ela, a tabela desempata pelo id interno). */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }

/** O contato principal fica SEMPRE em primeiro e destacado (qualquer ordenação ou filtro). */
const ehPrincipal = (k: ContatoCliente) => k.principal

export function AbaContatos({ c, onEditar }: { c: Cliente; onEditar: () => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)

  const colunas = useMemo<DataTableColumn<ContatoCliente>[]>(
    () => [
      {
        id: 'nome',
        header: t('clientes.form.contactName'),
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
                {t('clientes.form.main')}
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'email',
        header: t('clientes.form.email'),
        type: 'unique-text',
        accessor: (r) => r.email,
        size: 300,
        cell: (r) => <EmailLink email={r.email} />,
      },
      {
        id: 'telefone',
        header: t('clientes.form.phone'),
        type: 'unique-text',
        accessor: (r) => r.telefone,
        size: 170,
        cell: (r) => <span className="num">{formatPhone(r.telefone)}</span>,
        exportValue: (r) => formatPhone(r.telefone),
      },
      {
        id: 'principal',
        header: t('clientes.form.main'),
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
      id="cliente-contatos"
      title={t('clientes.tabs.contatos')}
      columns={colunas}
      getRowId={(r) => r.id}
      data={c.contatos}
      query={query}
      onQueryChange={setQuery}
      pinTop={ehPrincipal}
      highlightRow={ehPrincipal}
      exportName={`contatos-${c.codigo}`}
      toolbar={
        <Can permission="clientes.editar" fallback="hide">
          <Button size="sm" variant="secondary" onClick={onEditar}>
            <Pencil aria-hidden />
            {t('clientes.detail.manageContacts')}
          </Button>
        </Can>
      }
    />
  )
}
