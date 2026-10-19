import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useCan } from '@/hooks/use-can'
import { formatNumber } from '@/lib/format'
import type { Cliente, Doca, SiteCliente } from '@/services/types'
import { useRemoverSite, useSites } from '../use-clientes'
import { SiteSheet } from './SiteSheet'

/** Ordem inicial (sem ela, a tabela desempata pelo id interno). */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'codigo', desc: false }] }

/** Lista vazia estável (a tabela não pode receber um array novo a cada render). */
const SEM_SITES: SiteCliente[] = []

/**
 * Clientes › Logística: sites do cliente (com as docas ao expandir a linha). Cadastro e
 * edição num painel lateral, sem sair da aba.
 */
export function AbaLogistica({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const sites = useSites(c.id)
  const remover = useRemoverSite(c.id)
  const podeEditar = useCan('clientes.editar')
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<SiteCliente | undefined>()
  const [apagar, setApagar] = useState<SiteCliente | null>(null)

  const abrir = (s?: SiteCliente) => {
    setEditando(s)
    setAberto(true)
  }

  const colunas = useMemo<DataTableColumn<SiteCliente>[]>(
    () => [
      {
        id: 'codigo',
        header: t('clientes.sites.campos.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 130,
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'regiao',
        header: t('clientes.sites.campos.regiao'),
        type: 'unique-text',
        accessor: (r) => r.regiao,
        size: 130,
      },
      {
        id: 'endereco',
        header: t('clientes.sites.campos.endereco'),
        type: 'unique-text',
        accessor: (r) => r.endereco,
        size: 280,
      },
      {
        id: 'docas',
        header: t('clientes.sites.secoes.docas'),
        type: 'number',
        accessor: (r) => r.docas.length,
        size: 100,
      },
      {
        id: 'totalGaylords',
        header: t('clientes.sites.campos.totalGaylords'),
        type: 'number',
        accessor: (r) => r.totalGaylords,
        size: 140,
      },
      {
        id: 'shredderProprio',
        header: t('clientes.sites.campos.shredderProprio'),
        type: 'boolean',
        accessor: (r) => r.shredderProprio,
        size: 150,
      },
      {
        id: 'edgeSite',
        header: t('clientes.sites.campos.edgeSite'),
        type: 'boolean',
        accessor: (r) => r.edgeSite,
        size: 120,
      },
      {
        id: 'responsavel',
        header: t('clientes.sites.campos.responsavel'),
        type: 'unique-text',
        accessor: (r) => r.responsavel?.nome ?? r.responsavel?.email ?? null,
        size: 200,
      },
      {
        id: 'horario',
        header: t('clientes.sites.campos.horario'),
        type: 'unique-text',
        accessor: (r) => r.horario,
        size: 200,
        hidden: true,
      },
    ],
    [t],
  )

  return (
    <>
      <DataTable
        id="cliente-sites"
        title={t('clientes.tabs.logistica')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={sites.data ?? SEM_SITES}
        query={query}
        onQueryChange={setQuery}
        loading={sites.isPending}
        error={sites.isError}
        onRetry={() => void sites.refetch()}
        exportName={`sites-${c.codigo}`}
        onRowClick={podeEditar ? (s) => abrir(s) : undefined}
        onCreate={podeEditar ? () => abrir() : undefined}
        createLabel={t('clientes.sites.newTitle')}
        renderExpanded={(s) => <DocasDoSite docas={s.docas} />}
        empty={{
          title: t('clientes.sites.vazioTitle'),
          description: t('clientes.sites.vazioBody'),
          action: podeEditar ? (
            <Button onClick={() => abrir()}>
              <Plus aria-hidden />
              {t('clientes.sites.newTitle')}
            </Button>
          ) : undefined,
        }}
        rowActions={(s) => (
          <Can permission="clientes.editar">
            <>
              <DropdownMenuItem onSelect={() => abrir(s)}>
                <Pencil aria-hidden />
                {t('common.edit')}
              </DropdownMenuItem>
              <Can permission="clientes.excluir">
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setApagar(s)}>
                    <Trash2 aria-hidden />
                    {t('common.delete')}
                  </DropdownMenuItem>
                </>
              </Can>
            </>
          </Can>
        )}
      />

      {aberto && (
        <SiteSheet
          clienteId={c.id}
          contatos={c.contatos}
          site={editando}
          open={aberto}
          onOpenChange={setAberto}
        />
      )}

      <ConfirmDialog
        open={Boolean(apagar)}
        onOpenChange={(o) => !o && setApagar(null)}
        variant="destructive"
        title={t('clientes.sites.apagarTitle', { code: apagar?.codigo ?? '' })}
        description={t('clientes.sites.apagarBody')}
        confirmLabel={t('common.delete')}
        confirmText={apagar?.codigo}
        onConfirm={async () => {
          if (apagar) await remover.mutateAsync({ siteId: apagar.id, codigo: apagar.codigo })
        }}
      />
    </>
  )
}

/** Docas do site (linha expandida). */
function DocasDoSite({ docas }: { docas: Doca[] }) {
  const { t } = useTranslation()
  if (!docas.length)
    return (
      <p className="px-4 py-3 type-body text-muted-foreground">{t('clientes.sites.semDocas')}</p>
    )
  const simNao = (v: boolean) => (v ? t('dataTable.yes') : t('dataTable.no'))
  const medida = (v: number | null, unidade: string) =>
    v === null ? '—' : `${formatNumber(v, { maximumFractionDigits: 2 })} ${unidade}`
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
      {docas.map((d) => (
        <li key={d.id} className="rounded-md border bg-card p-3">
          <p className="mb-2 type-label">
            {t('clientes.sites.campos.numeroDoca')}: <span className="font-mono">{d.numero}</span>
          </p>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 type-caption">
            <dt className="text-muted-foreground">
              {t('clientes.sites.campos.alturaMaxCaminhao')}
            </dt>
            <dd className="num">{medida(d.alturaMaxCaminhao, 'm')}</dd>
            <dt className="text-muted-foreground">
              {t('clientes.sites.campos.comprimentoMaxCaminhao')}
            </dt>
            <dd className="num">{medida(d.comprimentoMaxCaminhao, 'm')}</dd>
            <dt className="text-muted-foreground">{t('clientes.sites.campos.dockLeveler')}</dt>
            <dd>{simNao(d.dockLeveler)}</dd>
            <dt className="text-muted-foreground">{t('clientes.sites.campos.tailLift')}</dt>
            <dd>{simNao(d.tailLift)}</dd>
            <dt className="text-muted-foreground">{t('clientes.sites.campos.areaLift')}</dt>
            <dd className="num">{medida(d.areaLift, 'm²')}</dd>
            <dt className="text-muted-foreground">{t('clientes.sites.campos.espaco')}</dt>
            <dd className="num">{medida(d.espaco, 'm²')}</dd>
            <dt className="text-muted-foreground">{t('clientes.sites.campos.altura')}</dt>
            <dd className="num">{medida(d.altura, 'm')}</dd>
            <dt className="text-muted-foreground">{t('clientes.sites.campos.voltagemShredder')}</dt>
            <dd className="num">{d.voltagemShredder === null ? '—' : `${d.voltagemShredder} V`}</dd>
            <dt className="text-muted-foreground">
              {t('clientes.sites.campos.pisoProtecaoObrigatorio')}
            </dt>
            <dd>{simNao(d.pisoProtecaoObrigatorio)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}
