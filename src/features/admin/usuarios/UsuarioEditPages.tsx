import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { FormPage } from '@/components/patterns/FormPage'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { ApiError } from '@/services/http'
import type { Usuario } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import { isEmailEmUso, useSalvarUsuario, useUsuario } from './use-usuarios'
import { UsuarioFields } from './usuario-form'
import {
  formParaInput,
  novoUsuarioForm,
  usuarioParaForm,
  usuarioSchema,
  type UsuarioForm,
} from './usuario-schema'

/** Salva e, se o e-mail já estiver em uso, mostra o erro no próprio campo. */
function useEnviar(form: UseFormReturn<UsuarioForm>, id?: string) {
  const { t } = useTranslation()
  const salvar = useSalvarUsuario(id)
  return (depois: (u: Usuario) => void) =>
    form.handleSubmit(async (v) => {
      const salvo = await salvar.mutateAsync(formParaInput(usuarioSchema.parse(v))).catch((e) => {
        if (isEmailEmUso(e))
          form.setError('email', { message: t('apiErrors.emailInUse') }, { shouldFocus: true })
        return null
      })
      if (!salvo) return
      form.reset(usuarioParaForm(salvo)) // limpa o "sujo" antes de sair
      depois(salvo)
    })
}

/* ================================================================ NOVO */

/** Admin › Usuários › novo (padrão Cadastro). */
export function UsuarioNovoPage() {
  return (
    <RequirePermission permission="admin.criar">
      <Novo />
    </RequirePermission>
  )
}

function Novo() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useBreadcrumb({ parent: '/admin/usuarios', label: t('usuarios.new.title') })
  const form = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    mode: 'onTouched',
    defaultValues: novoUsuarioForm(),
  })
  const enviar = useEnviar(form)

  return (
    <FormPage
      title={t('usuarios.new.title')}
      description={t('usuarios.new.description')}
      onSubmit={() =>
        void enviar((u) => void navigate({ to: '/admin/usuarios/$id', params: { id: u.id } }))()
      }
      onCancel={() => void navigate({ to: '/admin/usuarios' })}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
    >
      <UsuarioFields form={form} />
    </FormPage>
  )
}

/* ================================================================ EDITAR */

/** Admin › Usuários › editar (padrão Cadastro). */
export function UsuarioEditPage() {
  const { id } = useParams({ from: '/_app/admin/usuarios/$id/editar' })
  return (
    <RequirePermission permission="admin.editar">
      <Editar id={id} />
    </RequirePermission>
  )
}

function Editar({ id }: { id: string }) {
  const query = useUsuario(id)
  useBreadcrumb(query.data ? { parent: '/admin/usuarios', label: query.data.codigo } : null)
  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFoundContent />
  if (query.isError || !query.data)
    return <AppError error={query.error} reset={() => void query.refetch()} />
  return <EditarForm usuario={query.data} />
}

function EditarForm({ usuario }: { usuario: Usuario }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const form = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    mode: 'onTouched',
    defaultValues: usuarioParaForm(usuario),
  })
  const enviar = useEnviar(form, usuario.id)
  const voltar = () => void navigate({ to: '/admin/usuarios/$id', params: { id: usuario.id } })

  return (
    <FormPage
      title={t('usuarios.edit.title', { name: usuario.nome })}
      description={usuario.codigo}
      status={<StatusBadge status={usuario.status} />}
      onSubmit={() => void enviar(voltar)()}
      onCancel={voltar}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
    >
      <UsuarioFields form={form} />
    </FormPage>
  )
}
