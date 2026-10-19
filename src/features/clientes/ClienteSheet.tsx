import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSheet } from '@/features/comum/CadastroSheet'
import type { Cliente } from '@/services/types'
import { ClienteFields } from './cliente-form'
import {
  clienteParaForm,
  clienteSchema,
  formParaInput,
  novoClienteForm,
  type ClienteForm,
} from './cliente-schema'
import { isCnpjEmUso, useCliente, useSalvarCliente } from './use-clientes'

/**
 * Cadastro e edição do cliente no painel lateral (padrão de cadastro). `id` = editar;
 * sem `id` = novo. `onSalvo` recebe o cliente salvo (ex.: abrir o detalhe do novo).
 */
export function ClienteSheet({
  id,
  onClose,
  onSalvo,
}: {
  id?: string
  onClose: () => void
  onSalvo?: (c: Cliente) => void
}) {
  const detalhe = useCliente(id)
  if (id && detalhe.isPending)
    return (
      <div className="sr-only" aria-busy>
        <Skeleton />
      </div>
    )
  return (
    <Formulario
      cliente={detalhe.data}
      erro={id ? detalhe.isError : false}
      onClose={onClose}
      onSalvo={onSalvo}
    />
  )
}

function Formulario({
  cliente,
  erro,
  onClose,
  onSalvo,
}: {
  cliente?: Cliente
  erro: boolean
  onClose: () => void
  onSalvo?: (c: Cliente) => void
}) {
  const { t } = useTranslation()
  const salvar = useSalvarCliente(cliente?.id)
  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    mode: 'onTouched',
    defaultValues: cliente ? clienteParaForm(cliente) : novoClienteForm(),
  })

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar.mutateAsync(formParaInput(clienteSchema.parse(v))).catch((e) => {
      // CNPJ repetido: erro no próprio campo.
      if (isCnpjEmUso(e))
        form.setError('cnpj', { message: t('apiErrors.cnpjInUse') }, { shouldFocus: true })
      return null
    })
    if (!salvo) return
    form.reset(clienteParaForm(salvo)) // limpa o "sujo" antes de fechar
    onClose()
    onSalvo?.(salvo)
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={cliente ? t('clientes.edit.title', { name: cliente.nome }) : t('clientes.new.title')}
      descricao={cliente ? cliente.codigo : t('clientes.new.description')}
      status={cliente ? <StatusBadge status={cliente.status} /> : undefined}
      formId="form-cliente"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={cliente ? 'clientes.editar' : 'clientes.criar'}
      dados={
        <form
          id="form-cliente"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          <ClienteFields form={form} />
        </form>
      }
    />
  )
}
