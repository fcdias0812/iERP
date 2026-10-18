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
import type { Cliente } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import { ClienteFields } from './cliente-form'
import {
  clienteParaForm,
  clienteSchema,
  formParaInput,
  novoClienteForm,
  type ClienteForm,
} from './cliente-schema'
import { isCnpjEmUso, useCliente, useSalvarCliente } from './use-clientes'

/** Salva e, se o CNPJ já estiver em uso, mostra o erro no próprio campo. */
function useEnviar(form: UseFormReturn<ClienteForm>, id?: string) {
  const { t } = useTranslation()
  const salvar = useSalvarCliente(id)
  return (depois: (c: Cliente) => void) =>
    form.handleSubmit(async (v) => {
      const salvo = await salvar.mutateAsync(formParaInput(clienteSchema.parse(v))).catch((e) => {
        if (isCnpjEmUso(e))
          form.setError('cnpj', { message: t('apiErrors.cnpjInUse') }, { shouldFocus: true })
        return null
      })
      if (!salvo) return
      form.reset(clienteParaForm(salvo)) // limpa o "sujo" antes de sair
      depois(salvo)
    })
}

/* ================================================================ NOVO */

/** Clientes › novo (padrão Cadastro). */
export function ClienteNovoPage() {
  return (
    <RequirePermission permission="clientes.criar">
      <Novo />
    </RequirePermission>
  )
}

function Novo() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useBreadcrumb({ parent: '/clientes', label: t('clientes.new.title') })
  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    mode: 'onTouched',
    defaultValues: novoClienteForm(),
  })
  const enviar = useEnviar(form)

  return (
    <FormPage
      title={t('clientes.new.title')}
      description={t('clientes.new.description')}
      onSubmit={() =>
        void enviar((c) => void navigate({ to: '/clientes/$id', params: { id: c.id } }))()
      }
      onCancel={() => void navigate({ to: '/clientes' })}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
    >
      <ClienteFields form={form} />
    </FormPage>
  )
}

/* ================================================================ EDITAR */

/** Clientes › editar (padrão Cadastro). */
export function ClienteEditPage() {
  const { id } = useParams({ from: '/_app/clientes/$id/editar' })
  return (
    <RequirePermission permission="clientes.editar">
      <Editar id={id} />
    </RequirePermission>
  )
}

function Editar({ id }: { id: string }) {
  const query = useCliente(id)
  useBreadcrumb(query.data ? { parent: '/clientes', label: query.data.codigo } : null)
  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFoundContent />
  if (query.isError || !query.data)
    return <AppError error={query.error} reset={() => void query.refetch()} />
  return <EditarForm cliente={query.data} />
}

function EditarForm({ cliente }: { cliente: Cliente }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    mode: 'onTouched',
    defaultValues: clienteParaForm(cliente),
  })
  const enviar = useEnviar(form, cliente.id)
  const voltar = () => void navigate({ to: '/clientes/$id', params: { id: cliente.id } })

  return (
    <FormPage
      title={t('clientes.edit.title', { name: cliente.nome })}
      description={cliente.codigo}
      status={<StatusBadge status={cliente.status} />}
      onSubmit={() => void enviar(voltar)()}
      onCancel={voltar}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
    >
      <ClienteFields form={form} />
    </FormPage>
  )
}
