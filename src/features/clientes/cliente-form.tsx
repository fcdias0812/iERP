import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Star, Trash2 } from 'lucide-react'
import { FormSection } from '@/components/patterns/FormPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { MAX_CONTATOS } from './fluxo'
import { contatoVazio, type ClienteForm } from './cliente-schema'

/** Seções do formulário do cliente (mesmas no Novo e no Editar). */
export function ClienteFields({ form }: { form: UseFormReturn<ClienteForm> }) {
  const { t } = useTranslation()
  return (
    <>
      <FormSection title={t('clientes.form.identification')}>
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
      </FormSection>
      <FormSection
        title={t('clientes.form.contacts')}
        description={t('clientes.form.contactsHelp')}
        columns={1}
      >
        <ContatosEditor form={form} />
      </FormSection>
    </>
  )
}

/** Lista de contatos: o primeiro é o principal; "Tornar principal" leva o contato para o topo. */
function ContatosEditor({ form }: { form: UseFormReturn<ClienteForm> }) {
  const { t } = useTranslation()
  const contatos = useFieldArray({ control: form.control, name: 'contatos' })

  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-label={t('clientes.form.contacts')}>
        {contatos.fields.map((f, i) => {
          const n = i + 1
          return (
            <li key={f.id} className="rounded-lg border bg-card p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 type-label">
                  {t('clientes.form.contactN', { n })}
                  {i === 0 && <Badge variant="info">{t('clientes.form.main')}</Badge>}
                </p>
                <div className="flex items-center gap-1">
                  {i > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => contatos.move(i, 0)}>
                      <Star aria-hidden />
                      {t('clientes.form.makeMain')}
                      <span className="sr-only"> ({t('clientes.form.contactN', { n })})</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={contatos.fields.length === 1}
                    onClick={() => contatos.remove(i)}
                    aria-label={t('clientes.form.removeN', { n })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,11rem)]">
                <RhfField
                  control={form.control}
                  name={`contatos.${i}.nome`}
                  label={t('clientes.form.contactName')}
                >
                  {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
                </RhfField>
                <RhfField
                  control={form.control}
                  name={`contatos.${i}.email`}
                  label={t('clientes.form.email')}
                  required
                >
                  {({ field, control }) => (
                    <Input
                      {...control}
                      {...field}
                      type="email"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </RhfField>
                <RhfField
                  control={form.control}
                  name={`contatos.${i}.telefone`}
                  label={t('clientes.form.phone')}
                  required
                >
                  {({ field, control }) => (
                    <MaskedInput
                      {...control}
                      kind="phone"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                </RhfField>
              </div>
            </li>
          )
        })}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        disabled={contatos.fields.length >= MAX_CONTATOS}
        onClick={() => contatos.append(contatoVazio())}
      >
        <Plus aria-hidden />
        {t('clientes.form.addContact')}
      </Button>
    </div>
  )
}
