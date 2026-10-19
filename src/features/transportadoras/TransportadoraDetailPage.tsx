import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  CircleCheck,
  CircleMinus,
  ClipboardList,
  History,
  IdCard,
  Pencil,
  Users,
} from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { DetailPage } from '@/components/patterns/DetailPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AuditInfo, CopyableId, KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ContatosTabela, EmailLink } from '@/features/comum/ContatosTabela'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { formatCnpj, formatCpf, formatNumber, formatPhone } from '@/lib/format'
import { ApiError } from '@/services/http'
import type { AcaoCadastro, MotoristaResumo, Transportadora } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import type { AbaTransportadora } from './abas'
import { TransportadoraSheet } from './TransportadoraSheet'
import { transportadorasHooks } from './use-transportadoras'

/** Transportadoras › detalhe (padrão Detalhe): dados, contatos, motoristas e histórico. */
export function TransportadoraDetailPage() {
  const { id } = useParams({ from: '/_app/transportadoras/$id/' })
  return (
    <RequirePermission permission="transportadoras.ver">
      <TransportadoraDetail id={id} />
    </RequirePermission>
  )
}

function TransportadoraDetail({ id }: { id: string }) {
  const query = transportadorasHooks.useDetalhe(id)
  const tr = query.data
  useBreadcrumb(tr ? { parent: '/transportadoras', label: tr.codigo } : null)

  if (query.isPending)
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFoundContent />
  if (query.isError || !tr)
    return <AppError error={query.error} reset={() => void query.refetch()} />
  return <Detalhe tr={tr} />
}

function Detalhe({ tr }: { tr: Transportadora }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aba = 'dados', editar: editando } = useSearch({ from: '/_app/transportadoras/$id/' })
  const transicao = transportadorasHooks.useTransicao()
  const [confirm, setConfirm] = useState<AcaoCadastro | null>(null)

  const trocarAba = (nova: string) =>
    void navigate({
      to: '/transportadoras/$id',
      params: { id: tr.id },
      search: { aba: nova === 'dados' ? undefined : (nova as AbaTransportadora) },
      replace: true,
    })
  const painel = (aberto: boolean) =>
    void navigate({
      to: '/transportadoras/$id',
      params: { id: tr.id },
      search: { aba: aba === 'dados' ? undefined : aba, editar: aberto || undefined },
    })
  const editar = () => painel(true)

  const botaoEditar = (rotulo: string) => (
    <Can permission="transportadoras.editar" fallback="hide">
      <Button size="sm" variant="secondary" onClick={editar}>
        <Pencil aria-hidden />
        {rotulo}
      </Button>
    </Can>
  )

  return (
    <>
      <DetailPage
        title={tr.nome}
        description={formatCnpj(tr.cnpj)}
        status={<StatusBadge status={tr.status} />}
        tab={aba}
        onTabChange={trocarAba}
        meta={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <CopyableId value={tr.codigo} />
            <AuditInfo
              createdBy={tr.criadoPor}
              createdAt={tr.criadoEm}
              updatedBy={tr.alteradoPor}
              updatedAt={tr.alteradoEm}
              className="sm:flex-row sm:gap-3"
            />
          </div>
        }
        alerts={
          tr.status === 'inativo' ? (
            <Alert tone="inactive" title={t('transportadoras.inativoTitle')}>
              {t('transportadoras.inativoBody')}
            </Alert>
          ) : undefined
        }
        actions={
          <>
            <Can permission="transportadoras.editar" fallback="disable">
              <Button variant="secondary" onClick={editar}>
                <Pencil aria-hidden />
                {t('common.edit')}
              </Button>
            </Can>
            {tr.acoesPermitidas.map((acao) => (
              <Can key={acao} permission="transportadoras.editar" fallback="disable">
                <Button
                  variant={acao === 'inativar' ? 'secondary' : 'default'}
                  loading={transicao.isPending && transicao.variables?.acao === acao}
                  onClick={() => setConfirm(acao)}
                >
                  {acao === 'inativar' ? <CircleMinus aria-hidden /> : <CircleCheck aria-hidden />}
                  {t(`transportadoras.acoes.${acao}`)}
                </Button>
              </Can>
            ))}
          </>
        }
        tabs={[
          {
            id: 'dados',
            label: t('transportadoras.tabs.dados'),
            icon: ClipboardList,
            content: <AbaDados tr={tr} />,
          },
          {
            id: 'contatos',
            label: t('transportadoras.tabs.contatos'),
            icon: Users,
            count: tr.contatos.length,
            content: (
              <ContatosTabela
                id="transportadora-contatos"
                titulo={t('transportadoras.tabs.contatos')}
                contatos={tr.contatos}
                exportName={`contatos-${tr.codigo}`}
                toolbar={botaoEditar(t('transportadoras.detail.editar'))}
              />
            ),
          },
          {
            id: 'motoristas',
            label: t('transportadoras.tabs.motoristas'),
            icon: IdCard,
            count: tr.motoristas.length,
            content: (
              <MotoristasDaTransportadora
                tr={tr}
                toolbar={botaoEditar(t('transportadoras.detail.editar'))}
              />
            ),
          },
          {
            id: 'historico',
            label: t('transportadoras.tabs.historico'),
            icon: History,
            content: <AbaHistorico tr={tr} />,
          },
        ]}
      />

      {editando && <TransportadoraSheet id={tr.id} onClose={() => painel(false)} />}

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t(`transportadoras.confirm.${confirm}.title`, { name: tr.nome }) : ''}
        description={confirm ? t(`transportadoras.confirm.${confirm}.body`) : ''}
        confirmLabel={confirm ? t(`transportadoras.acoes.${confirm}`) : ''}
        onConfirm={async () => {
          if (confirm) await transicao.mutateAsync({ id: tr.id, acao: confirm })
        }}
      />
    </>
  )
}

/** Dados da transportadora e o contato principal. */
function AbaDados({ tr }: { tr: Transportadora }) {
  const { t } = useTranslation()
  const principal = tr.contatos.find((k) => k.principal)
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('transportadoras.detail.general')}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueList
            items={[
              {
                label: t('transportadoras.cols.codigo'),
                value: <span className="font-mono">{tr.codigo}</span>,
              },
              { label: t('transportadoras.cols.nome'), value: tr.nome },
              {
                label: t('transportadoras.cols.cnpj'),
                value: <span className="font-mono">{formatCnpj(tr.cnpj)}</span>,
              },
              {
                label: t('transportadoras.cols.motoristas'),
                value: <span className="num">{formatNumber(tr.motoristas.length)}</span>,
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('transportadoras.detail.mainContact')}</CardTitle>
        </CardHeader>
        <CardContent>
          {principal ? (
            <KeyValueList
              items={[
                { label: t('contatos.nome'), value: principal.nome },
                { label: t('contatos.email'), value: <EmailLink email={principal.email} /> },
                {
                  label: t('contatos.telefone'),
                  value: <span className="num">{formatPhone(principal.telefone)}</span>,
                },
              ]}
            />
          ) : (
            <p className="type-body text-muted-foreground">
              {t('transportadoras.detail.noContacts')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const ORDEM_MOTORISTAS: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }

/** Motoristas vinculados; clicar abre o motorista em Motoristas. */
function MotoristasDaTransportadora({ tr, toolbar }: { tr: Transportadora; toolbar: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState<TableQuery>(ORDEM_MOTORISTAS)
  const colunas = useMemo<DataTableColumn<MotoristaResumo>[]>(
    () => [
      {
        id: 'nome',
        header: t('motoristas.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 260,
        mobile: 'title',
      },
      {
        id: 'cpf',
        header: t('motoristas.cols.cpf'),
        type: 'unique-text',
        accessor: (r) => r.cpf,
        size: 160,
        cell: (r) => <span className="font-mono">{formatCpf(r.cpf)}</span>,
        exportValue: (r) => formatCpf(r.cpf),
      },
      {
        id: 'telefone',
        header: t('motoristas.cols.telefone'),
        type: 'unique-text',
        accessor: (r) => r.telefone,
        size: 170,
        cell: (r) => <span className="num">{formatPhone(r.telefone)}</span>,
        exportValue: (r) => formatPhone(r.telefone),
      },
      {
        id: 'status',
        header: t('motoristas.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 120,
        mobile: 'badge',
        options: ['ativo', 'inativo'].map((s) => ({ value: s, label: s })),
      },
    ],
    [t],
  )
  return (
    <DataTable
      id="transportadora-motoristas"
      title={t('transportadoras.tabs.motoristas')}
      columns={colunas}
      getRowId={(r) => r.id}
      data={tr.motoristas}
      query={query}
      onQueryChange={setQuery}
      exportName={`motoristas-${tr.codigo}`}
      toolbar={toolbar}
      onRowClick={(r) => void navigate({ to: '/motoristas', search: { aberto: r.id } })}
      empty={{ title: t('transportadoras.form.semMotoristas') }}
    />
  )
}

const CAMPOS = ['nome', 'cnpj', 'contatos', 'motoristas', 'status'] as const

function AbaHistorico({ tr }: { tr: Transportadora }) {
  const { t } = useTranslation()
  const acoes = useMemo(
    () => ({
      criado: t('historico.acoes.criado'),
      editado: t('historico.acoes.editado'),
      status: t('historico.acoes.status'),
    }),
    [t],
  )
  const campos = useMemo(
    () => Object.fromEntries(CAMPOS.map((k) => [k, t(`transportadoras.campos.${k}`)])),
    [t],
  )
  return (
    <HistoricoTabela
      id="transportadora-historico"
      titulo={t('transportadoras.tabs.historico')}
      historico={tr.historico}
      exportName={`historico-${tr.codigo}`}
      acoes={acoes}
      campos={campos}
    />
  )
}
