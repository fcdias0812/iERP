import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { toast } from '@/components/ui/sonner'
import { CadastroSheet } from '@/features/comum/CadastroSheet'
import { apiErrorMessage } from '@/lib/api-errors'
import { ApiError } from '@/services/http'
import type { Transportadora } from '@/services/types'
import { TransportadoraFields } from './transportadora-form'
import {
  formParaInput,
  novaTransportadoraForm,
  transportadoraParaForm,
  transportadoraSchema,
  type TransportadoraForm,
} from './transportadora-schema'
import { transportadorasHooks } from './use-transportadoras'

/**
 * Cadastro e edição da transportadora no painel lateral (padrão de cadastro). `id` = editar;
 * sem `id` = nova. `onSalvo` recebe a transportadora salva (ex.: abrir o detalhe da nova).
 */
export function TransportadoraSheet({
  id,
  onClose,
  onSalvo,
}: {
  id?: string
  onClose: () => void
  onSalvo?: (tr: Transportadora) => void
}) {
  const detalhe = transportadorasHooks.useDetalhe(id)
  if (id && detalhe.isPending)
    return (
      <div className="sr-only" aria-busy>
        <Skeleton />
      </div>
    )
  return (
    <Formulario
      tr={detalhe.data}
      erro={id ? detalhe.isError : false}
      onClose={onClose}
      onSalvo={onSalvo}
    />
  )
}

function Formulario({
  tr,
  erro,
  onClose,
  onSalvo,
}: {
  tr?: Transportadora
  erro: boolean
  onClose: () => void
  onSalvo?: (tr: Transportadora) => void
}) {
  const { t } = useTranslation()
  const salvar = transportadorasHooks.useSalvar(tr?.id)
  const form = useForm<TransportadoraForm>({
    resolver: zodResolver(transportadoraSchema),
    mode: 'onTouched',
    defaultValues: tr ? transportadoraParaForm(tr) : novaTransportadoraForm(),
  })

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar
      .mutateAsync(formParaInput(transportadoraSchema.parse(v)))
      .catch((e: unknown) => {
        // CNPJ repetido: erro no próprio campo. CPF repetido (motorista novo): aviso — o
        // servidor não diz qual linha.
        if (e instanceof ApiError && e.code === 'cnpj_in_use')
          form.setError('cnpj', { message: apiErrorMessage(e) }, { shouldFocus: true })
        if (e instanceof ApiError && e.code === 'cpf_in_use')
          toast.error(t('transportadoras.toast.saveFailed'), { description: apiErrorMessage(e) })
        return null
      })
    if (!salvo) return
    form.reset(transportadoraParaForm(salvo)) // limpa o "sujo" antes de fechar
    onClose()
    onSalvo?.(salvo)
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={
        tr ? t('transportadoras.edit.title', { name: tr.nome }) : t('transportadoras.new.title')
      }
      descricao={tr ? tr.codigo : t('transportadoras.new.description')}
      status={tr ? <StatusBadge status={tr.status} /> : undefined}
      formId="form-transportadora"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={tr ? 'transportadoras.editar' : 'transportadoras.criar'}
      dados={
        <form
          id="form-transportadora"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          <TransportadoraFields form={form} id={tr?.id} />
        </form>
      }
    />
  )
}
