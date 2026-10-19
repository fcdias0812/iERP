import { useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FileText, History, LayoutDashboard, Pencil, Settings, Truck, Users } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { DetailPage } from '@/components/patterns/DetailPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AuditInfo, CopyableId } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { formatCnpj } from '@/lib/format'
import { ApiError } from '@/services/http'
import type { AcaoCliente, Cliente } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import type { AbaCliente } from './abas'
import { AbaContatos } from './detalhe/AbaContatos'
import { AbaDocumentos } from './detalhe/AbaDocumentos'
import { AbaHistorico } from './detalhe/AbaHistorico'
import { AbaLogistica } from './detalhe/AbaLogistica'
import { AbaVisaoGeral } from './detalhe/AbaVisaoGeral'
import { AbaEmDefinicao } from './detalhe/comum'
import { ACOES } from './fluxo'
import { useCliente, useDocumentos, useSites, useTransicaoCliente } from './use-clientes'

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

function Detalhe({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aba = 'visao-geral' } = useSearch({ from: '/_app/clientes/$id/' })
  const transicao = useTransicaoCliente()
  const [confirm, setConfirm] = useState<AcaoCliente | null>(null)
  // Contadores nas abas (a lista é pequena; as abas usam o mesmo cache).
  const sites = useSites(c.id)
  const docs = useDocumentos(c.id)

  const trocarAba = (nova: string) =>
    void navigate({
      to: '/clientes/$id',
      params: { id: c.id },
      search: { aba: nova === 'visao-geral' ? undefined : (nova as AbaCliente) },
      replace: true,
    })

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
            content: <AbaVisaoGeral c={c} />,
          },
          {
            id: 'contatos',
            label: t('clientes.tabs.contatos'),
            icon: Users,
            count: c.contatos.length,
            content: <AbaContatos c={c} onEditar={editar} />,
          },
          {
            id: 'logistica',
            label: t('clientes.tabs.logistica'),
            icon: Truck,
            count: sites.data?.length,
            content: <AbaLogistica c={c} />,
          },
          {
            id: 'documentos',
            label: t('clientes.tabs.documentos'),
            icon: FileText,
            count: docs.data?.length,
            content: <AbaDocumentos c={c} />,
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
            content: <AbaHistorico c={c} />,
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
