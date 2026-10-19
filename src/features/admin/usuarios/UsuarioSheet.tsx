import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSheet } from '@/features/comum/CadastroSheet'
import type { Usuario } from '@/services/types'
import { isEmailEmUso, useSalvarUsuario, useUsuario } from './use-usuarios'
import { UsuarioFields } from './usuario-form'
import {
  formParaInput,
  novoUsuarioForm,
  usuarioParaForm,
  usuarioSchema,
  type UsuarioForm,
} from './usuario-schema'

/**
 * Cadastro e edição do usuário no painel lateral (padrão de cadastro). `id` = editar;
 * sem `id` = novo. `onSalvo` recebe o usuário salvo (ex.: abrir o detalhe do novo).
 */
export function UsuarioSheet({
  id,
  onClose,
  onSalvo,
}: {
  id?: string
  onClose: () => void
  onSalvo?: (u: Usuario) => void
}) {
  const detalhe = useUsuario(id)
  if (id && detalhe.isPending)
    return (
      <div className="sr-only" aria-busy>
        <Skeleton />
      </div>
    )
  return (
    <Formulario
      usuario={detalhe.data}
      erro={id ? detalhe.isError : false}
      onClose={onClose}
      onSalvo={onSalvo}
    />
  )
}

function Formulario({
  usuario,
  erro,
  onClose,
  onSalvo,
}: {
  usuario?: Usuario
  erro: boolean
  onClose: () => void
  onSalvo?: (u: Usuario) => void
}) {
  const { t } = useTranslation()
  const salvar = useSalvarUsuario(usuario?.id)
  const form = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    mode: 'onTouched',
    defaultValues: usuario ? usuarioParaForm(usuario) : novoUsuarioForm(),
  })

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar.mutateAsync(formParaInput(usuarioSchema.parse(v))).catch((e) => {
      // E-mail repetido: erro no próprio campo.
      if (isEmailEmUso(e))
        form.setError('email', { message: t('apiErrors.emailInUse') }, { shouldFocus: true })
      return null
    })
    if (!salvo) return
    form.reset(usuarioParaForm(salvo)) // limpa o "sujo" antes de fechar
    onClose()
    onSalvo?.(salvo)
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={usuario ? t('usuarios.edit.title', { name: usuario.nome }) : t('usuarios.new.title')}
      descricao={usuario ? usuario.codigo : t('usuarios.new.description')}
      status={usuario ? <StatusBadge status={usuario.status} /> : undefined}
      formId="form-usuario"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={usuario ? 'admin.editar' : 'admin.criar'}
      dados={
        <form
          id="form-usuario"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          <UsuarioFields form={form} />
        </form>
      }
    />
  )
}
