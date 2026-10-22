import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { CadastroSecao } from '@/features/comum/CadastroSheet'
import { ContatosEditor, type ComContatos } from '@/features/comum/ContatosEditor'
import type { ClienteForm } from './cliente-schema'

/** Seções do formulário do cliente (painel lateral: novo e editar). */
export function ClienteFields({ form }: { form: UseFormReturn<ClienteForm> }) {
  const { t } = useTranslation()
  return (
    <>
      <CadastroSecao titulo={t('clientes.form.identification')}>
        <RhfField
          control={form.control}
          name="nome"
          label={t('clientes.cols.nome')}
          required
          maxLength={160}
          className="sm:col-span-2"
        >
          {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
        </RhfField>
        <RhfField control={form.control} name="cnpj" label={t('clientes.cols.cnpj')} required>
          {({ field, control }) => (
            <MaskedInput
              {...control}
              kind="cnpj"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        </RhfField>
      </CadastroSecao>
      <CadastroSecao
        titulo={t('clientes.form.contacts')}
        descricao={t('clientes.form.contactsHelp')}
        colunas={1}
      >
        <ContatosEditor
          form={form as unknown as UseFormReturn<ComContatos>}
          minimo={1}
          rotulo={t('clientes.form.contacts')}
        />
      </CadastroSecao>
    </>
  )
}
