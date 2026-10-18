import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormSection } from '@/components/patterns/FormPage'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PERFIS } from './fluxo'
import type { UsuarioForm } from './usuario-schema'

/* ------------------------------------------------------------ campos */

/** Seções do formulário de usuário (mesmas no Novo e no Editar). */
export function UsuarioFields({ form }: { form: UseFormReturn<UsuarioForm> }) {
  const { t } = useTranslation()
  return (
    <>
      <FormSection title={t('usuarios.form.identification')}>
        <RhfField
          control={form.control}
          name="nome"
          label={t('usuarios.cols.nome')}
          required
          maxLength={120}
        >
          {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
        </RhfField>
        <RhfField
          control={form.control}
          name="email"
          label={t('usuarios.cols.email')}
          required
          help={t('usuarios.form.emailHelp')}
        >
          {({ field, control }) => (
            <Input {...control} {...field} type="email" autoComplete="off" spellCheck={false} />
          )}
        </RhfField>
      </FormSection>
      <FormSection title={t('usuarios.form.access')}>
        <RhfField
          control={form.control}
          name="perfil"
          label={t('usuarios.cols.perfil')}
          required
          help={t('usuarios.form.profileHelp')}
        >
          {({ field, control }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger {...control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`roles.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </RhfField>
      </FormSection>
    </>
  )
}
