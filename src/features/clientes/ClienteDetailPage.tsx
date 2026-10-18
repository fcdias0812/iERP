import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FileText, History, LayoutDashboard, Pencil, Settings, Truck, Users } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { DetailPage } from '@/components/patterns/DetailPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { AuditInfo, CopyableId, KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Timeline, type TimelineEvent } from '@/components/ui/timeline'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { formatCnpj, formatDate, formatPhone } from '@/lib/format'
import type { StatusId } from '@/lib/status/statusMap'
import { ApiError } from '@/services/http'
import type { AcaoCliente, Cliente, ContatoCliente, Mudanca } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import type { AbaCliente } from './abas'
import { ACOES } from './fluxo'
import { useCliente, useTransicaoCliente } from './use-clientes'

/** Clientes › detalhe (padrão Detalhe) com uma aba para cada assunto do cliente. */
export function ClienteDetailPage() {
  const { id } = useParams({ from: '/_app/clientes/$id/' })
  return (
    <RequirePermission permission="clientes.ver">
      <ClienteDetail id={id} />
    </RequirePermission>
  )
}

function ClienteDetail({ id }: { id: string }) {
  const query = useCliente(id)
  const c = query.data
  useBreadcrumb(c ? { parent: '/clientes', label: c.codigo } : null)

  if (query.isPending) return <DetailSkeleton />
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFoundContent />
  if (query.isError || !c)
    return <AppError error={query.error} reset={() => void query.refetch()} />
  return <Detalhe c={c} />
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-60" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

const CAMPO_KEYS = {
  status: 'clientes.cols.status',
  nome: 'clientes.cols.nome',
  cnpj: 'clientes.cols.cnpj',
  contatos: 'clientes.tabs.contatos',
} as const

function Detalhe({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aba = 'visao-geral' } = useSearch({ from: '/_app/clientes/$id/' })
  const transicao = useTransicaoCliente()
  const [confirm, setConfirm] = useState<AcaoCliente | null>(null)
  const [contatosQuery, setContatosQuery] = useState<TableQuery>(EMPTY_QUERY)
  const principal = c.contatos.find((k) => k.principal) ?? c.contatos[0]

  const trocarAba = (nova: string) =>
    void navigate({
      to: '/clientes/$id',
      params: { id: c.id },
      search: { aba: nova === 'visao-geral' ? undefined : (nova as AbaCliente) },
      replace: true,
    })

  /** Valor legível de um campo do histórico. */
  const valor = (campo: string, v: Mudanca['antes']) => {
    if (v === null || v === '') return '—'
    if (campo === 'status') return t(`status.${v as StatusId}`)
    if (campo === 'cnpj') return formatCnpj(String(v))
    return String(v)
  }
  const eventos: TimelineEvent[] = c.historico.map((e) => ({
    id: e.id,
    actor: e.autor,
    at: e.em,
    action: t(`clientes.history.${e.acao}`),
    tone:
      e.acao === 'status'
        ? e.mudancas?.[0]?.depois === 'ativo'
          ? 'success'
          : 'inactive'
        : undefined,
    changes: e.mudancas?.map((m) => ({
      field: t(CAMPO_KEYS[m.campo as keyof typeof CAMPO_KEYS] ?? 'clientes.cols.status'),
      before: valor(m.campo, m.antes),
      after: valor(m.campo, m.depois),
    })),
    note: e.nota,
  }))

  const colunasContatos = useMemo<DataTableColumn<ContatoCliente>[]>(
    () => [
      {
        id: 'nome',
        header: t('clientes.form.contactName'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 220,
        mobile: 'title',
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
      },
    ],
    [t],
  )

  const acoes = [...c.acoesPermitidas].sort((a, b) => ACOES[a].peso - ACOES[b].peso)
  const editar = () => void navigate({ to: '/clientes/$id/editar', params: { id: c.id } })

  return (
    <>
      <DetailPage
        title={c.nome}
        description={formatCnpj(c.cnpj)}
        status={<StatusBadge status={c.status} />}
        tab={aba}
        onTabChange={trocarAba}
        meta={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <CopyableId value={c.codigo} />
            <AuditInfo
              createdBy={c.criadoPor}
              createdAt={c.criadoEm}
              updatedBy={c.alteradoPor}
              updatedAt={c.alteradoEm}
              className="sm:flex-row sm:gap-3"
            />
          </div>
        }
        alerts={
          c.status === 'inativo' ? (
            <Alert tone="inactive" title={t('clientes.detail.inactiveTitle')}>
              {t('clientes.detail.inactiveBody')}
            </Alert>
          ) : undefined
        }
        actions={
          <>
            <Can permission="clientes.editar" fallback="disable">
              <Button variant="secondary" onClick={editar}>
                <Pencil aria-hidden />
                {t('common.edit')}
              </Button>
            </Can>
            {acoes.map((acao) => {
              const meta = ACOES[acao]
              const Icon = meta.icon
              return (
                <Can key={acao} permission={meta.permission} fallback="disable">
                  <Button
                    variant={meta.variant}
                    loading={transicao.isPending && transicao.variables?.acao === acao}
                    onClick={() => setConfirm(acao)}
                  >
                    <Icon aria-hidden />
                    {t(`clientes.acoes.${acao}`)}
                  </Button>
                </Can>
              )
            })}
          </>
        }
        tabs={[
          {
            id: 'visao-geral',
            label: t('clientes.tabs.visaoGeral'),
            icon: LayoutDashboard,
            content: (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>{t('clientes.detail.general')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <KeyValueList
                      items={[
                        { label: t('clientes.cols.nome'), value: c.nome, full: true },
                        {
                          label: t('clientes.cols.cnpj'),
                          value: <span className="font-mono">{formatCnpj(c.cnpj)}</span>,
                        },
                        {
                          label: t('clientes.cols.codigo'),
                          value: <span className="font-mono">{c.codigo}</span>,
                        },
                        { label: t('clientes.cols.status'), value: t(`status.${c.status}`) },
                        { label: t('clientes.cols.criadoEm'), value: formatDate(c.criadoEm) },
                      ]}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('clientes.detail.mainContact')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {principal ? (
                      <KeyValueList
                        items={[
                          {
                            label: t('clientes.form.contactName'),
                            value: principal.nome,
                            full: true,
                          },
                          {
                            label: t('clientes.form.email'),
                            value: <EmailLink email={principal.email} />,
                            full: true,
                          },
                          {
                            label: t('clientes.form.phone'),
                            value: <span className="num">{formatPhone(principal.telefone)}</span>,
                            full: true,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyState size="sm" title={t('clientes.detail.noContacts')} />
                    )}
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: 'contatos',
            label: t('clientes.tabs.contatos'),
            icon: Users,
            count: c.contatos.length,
            content: (
              <DataTable
                id="cliente-contatos"
                title={t('clientes.tabs.contatos')}
                columns={colunasContatos}
                getRowId={(r) => r.id}
                data={c.contatos}
                query={contatosQuery}
                onQueryChange={setContatosQuery}
                exportName={`contatos-${c.codigo}`}
                toolbar={
                  <Can permission="clientes.editar" fallback="hide">
                    <Button size="sm" variant="secondary" onClick={editar}>
                      <Pencil aria-hidden />
                      {t('clientes.detail.manageContacts')}
                    </Button>
                  </Can>
                }
              />
            ),
          },
          {
            id: 'logistica',
            label: t('clientes.tabs.logistica'),
            icon: Truck,
            content: <AbaEmDefinicao icon={<Truck />} texto={t('clientes.tabs.logisticaHelp')} />,
          },
          {
            id: 'documentos',
            label: t('clientes.tabs.documentos'),
            icon: FileText,
            content: (
              <AbaEmDefinicao icon={<FileText />} texto={t('clientes.tabs.documentosHelp')} />
            ),
          },
          {
            id: 'configuracoes',
            label: t('clientes.tabs.configuracoes'),
            icon: Settings,
            content: (
              <AbaEmDefinicao icon={<Settings />} texto={t('clientes.tabs.configuracoesHelp')} />
            ),
          },
          {
            id: 'historico',
            label: t('clientes.tabs.historico'),
            icon: History,
            content: (
              <div className="max-w-3xl">
                <Timeline events={eventos} />
              </div>
            ),
          },
        ]}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t(`clientes.confirm.${confirm}.title`, { name: c.nome }) : ''}
        description={confirm ? t(`clientes.confirm.${confirm}.body`) : ''}
        confirmLabel={confirm ? t(`clientes.acoes.${confirm}`) : ''}
        onConfirm={async () => {
          if (confirm) await transicao.mutateAsync({ id: c.id, acao: confirm })
        }}
      />
    </>
  )
}

function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="break-all text-link underline-offset-4 hover:underline">
      {email}
    </a>
  )
}

/** Aba reservada: o conteúdo será definido depois. */
function AbaEmDefinicao({ icon, texto }: { icon: React.ReactNode; texto: string }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent>
        <EmptyState icon={icon} title={t('clientes.tabs.emDefinicao')} description={texto} />
      </CardContent>
    </Card>
  )
}
