import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ClipboardList, History, Pencil, UserPlus } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { DetailPage } from '@/components/patterns/DetailPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { AuditInfo, CopyableId, KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { Timeline, type TimelineEvent } from '@/components/ui/timeline'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { formatDateTime, formatRelative } from '@/lib/format'
import type { StatusId } from '@/lib/status/statusMap'
import { ApiError } from '@/services/http'
import type { AcaoUsuario, Mudanca, Usuario, UsuarioPerfil } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import { ACOES } from './fluxo'
import { useTransicaoUsuario, useUsuario } from './use-usuarios'

/** Admin › Usuários › detalhe (padrão Detalhe). */
export function UsuarioDetailPage() {
  const { id } = useParams({ from: '/_app/admin/usuarios/$id/' })
  return (
    <RequirePermission permission="admin.ver">
      <UsuarioDetail id={id} />
    </RequirePermission>
  )
}

function UsuarioDetail({ id }: { id: string }) {
  const query = useUsuario(id)
  const u = query.data
  useBreadcrumb(u ? { parent: '/admin/usuarios', label: u.codigo } : null)

  if (query.isPending) return <DetailSkeleton />
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFoundContent />
  if (query.isError || !u)
    return <AppError error={query.error} reset={() => void query.refetch()} />
  return <Detalhe u={u} />
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
  status: 'usuarios.cols.status',
  nome: 'usuarios.cols.nome',
  email: 'usuarios.cols.email',
  perfil: 'usuarios.cols.perfil',
} as const

function Detalhe({ u }: { u: Usuario }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const transicao = useTransicaoUsuario()
  const [confirm, setConfirm] = useState<AcaoUsuario | null>(null)
  const [bloqueio, setBloqueio] = useState(false)
  const [motivo, setMotivo] = useState('')

  const executar = (acao: AcaoUsuario, m?: string) =>
    transicao.mutateAsync({ id: u.id, acao, motivo: m })

  /** Valor legível de um campo do histórico. */
  const valor = (campo: string, v: Mudanca['antes']) => {
    if (v === null || v === '') return '—'
    if (campo === 'status') return t(`status.${v as StatusId}`)
    if (campo === 'perfil') return t(`roles.${v as UsuarioPerfil}`)
    return String(v)
  }
  const eventos: TimelineEvent[] = u.historico.map((e) => ({
    id: e.id,
    actor: e.autor,
    at: e.em,
    action: t(`usuarios.history.${e.acao}`),
    tone: e.acao === 'status' ? toneFor(e.mudancas?.[0]?.depois ?? null) : undefined,
    icon: e.acao === 'criado' ? UserPlus : undefined,
    changes: e.mudancas?.map((m) => ({
      field: t(CAMPO_KEYS[m.campo as keyof typeof CAMPO_KEYS] ?? 'usuarios.cols.status'),
      before: valor(m.campo, m.antes),
      after: valor(m.campo, m.depois),
    })),
    note: e.nota,
  }))

  const acoes = [...u.acoesPermitidas].sort((a, b) => ACOES[a].peso - ACOES[b].peso)
  const ultimoStatus = u.historico.find((e) => e.acao === 'status')

  return (
    <>
      <DetailPage
        title={u.nome}
        description={u.email}
        status={<StatusBadge status={u.status} />}
        meta={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <CopyableId value={u.codigo} />
            <AuditInfo
              createdBy={u.criadoPor}
              createdAt={u.criadoEm}
              updatedBy={u.alteradoPor}
              updatedAt={u.alteradoEm}
              className="sm:flex-row sm:gap-3"
            />
          </div>
        }
        alerts={
          u.status === 'bloqueado' ? (
            <Alert tone="inactive" title={t('usuarios.detail.blockedTitle')}>
              {ultimoStatus?.nota
                ? t('usuarios.detail.blockedReason', { reason: ultimoStatus.nota })
                : t('usuarios.detail.blockedBody')}
            </Alert>
          ) : u.status === 'inativo' ? (
            <Alert tone="inactive" title={t('usuarios.detail.inactiveTitle')}>
              {t('usuarios.detail.inactiveBody')}
            </Alert>
          ) : undefined
        }
        actions={
          <>
            <Can permission="admin.editar" fallback="disable">
              <Button
                variant="secondary"
                onClick={() =>
                  void navigate({ to: '/admin/usuarios/$id/editar', params: { id: u.id } })
                }
              >
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
                    onClick={() => {
                      if (meta.motivo) setBloqueio(true)
                      else if (meta.confirm) setConfirm(acao)
                      else void executar(acao)
                    }}
                  >
                    <Icon aria-hidden />
                    {t(`usuarios.acoes.${acao}`)}
                  </Button>
                </Can>
              )
            })}
          </>
        }
        tabs={[
          {
            id: 'data',
            label: t('usuarios.detail.tabData'),
            icon: ClipboardList,
            content: (
              <Card className="max-w-4xl">
                <CardHeader>
                  <CardTitle>{t('usuarios.detail.general')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <KeyValueList
                    items={[
                      { label: t('usuarios.cols.nome'), value: u.nome },
                      { label: t('usuarios.cols.email'), value: u.email },
                      { label: t('usuarios.cols.perfil'), value: t(`roles.${u.perfil}`) },
                      { label: t('usuarios.cols.status'), value: t(`status.${u.status}`) },
                      {
                        label: t('usuarios.cols.ultimoAcesso'),
                        value: u.ultimoAcesso ? (
                          <span title={formatDateTime(u.ultimoAcesso)}>
                            {formatRelative(u.ultimoAcesso)}
                          </span>
                        ) : (
                          t('usuarios.detail.neverAccessed')
                        ),
                      },
                      {
                        label: t('usuarios.cols.codigo'),
                        value: <span className="font-mono">{u.codigo}</span>,
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            ),
          },
          {
            id: 'history',
            label: t('usuarios.detail.tabHistory'),
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
        variant={confirm && ACOES[confirm].confirm === 'destructive' ? 'destructive' : 'default'}
        title={confirm ? t(`usuarios.confirm.${confirm}.title`, { name: u.nome }) : ''}
        description={confirm ? t(`usuarios.confirm.${confirm}.body`) : ''}
        confirmLabel={confirm ? t(`usuarios.acoes.${confirm}`) : ''}
        onConfirm={async () => {
          if (confirm) await executar(confirm)
        }}
      />

      <Dialog
        open={bloqueio}
        onOpenChange={(o) => {
          setBloqueio(o)
          if (!o) setMotivo('')
        }}
      >
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!motivo.trim()) return
              await executar('bloquear', motivo)
              setBloqueio(false)
              setMotivo('')
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('usuarios.confirm.bloquear.title', { name: u.nome })}</DialogTitle>
              <DialogDescription>{t('usuarios.confirm.bloquear.body')}</DialogDescription>
            </DialogHeader>
            <FormField
              label={t('usuarios.reason')}
              required
              counter={{ value: motivo.length, max: 300 }}
            >
              {(f) => (
                <Textarea
                  {...f}
                  value={motivo}
                  maxLength={300}
                  onChange={(e) => setMotivo(e.target.value)}
                  autoFocus
                />
              )}
            </FormField>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setBloqueio(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!motivo.trim()} loading={transicao.isPending}>
                {t('usuarios.acoes.bloquear')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function toneFor(status: Mudanca['depois']) {
  switch (status) {
    case 'ativo':
      return 'success' as const
    case 'bloqueado':
    case 'inativo':
      return 'inactive' as const
    default:
      return 'info' as const
  }
}
