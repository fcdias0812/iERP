import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CadastroSecao } from '@/features/comum/CadastroSheet'
import { usePerfis } from '@/hooks/use-can'
import { textoEm } from '@/lib/localized-text'
import { useUiStore } from '@/stores/ui-store'
import type { UsuarioForm } from './usuario-schema'

/* ------------------------------------------------------------ campos */

/** Seções do formulário de usuário (painel lateral: novo e editar). */
export function UsuarioFields({ form }: { form: UseFormReturn<UsuarioForm> }) {
  const { t } = useTranslation()
  const perfis = usePerfis()
  const idioma = useUiStore((s) => s.language)
  return (
    <>
      <CadastroSecao titulo={t('usuarios.form.identification')}>
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
      </CadastroSecao>
      <CadastroSecao titulo={t('usuarios.form.access')}>
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
                {(perfis.data ?? [])
                  .filter((p) => p.status === 'ativo' || p.id === field.value)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {textoEm(p.nome, idioma)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </RhfField>
      </CadastroSecao>
    </>
  )
}
