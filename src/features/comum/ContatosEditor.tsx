import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { contatoVazio, MAX_CONTATOS, type ContatoForm } from './contatos'

/** Formulário que tem uma lista `contatos`. */
export type ComContatos = { contatos: ContatoForm[] }

/**
 * Lista de contatos editável (Clientes, Transportadoras): o primeiro é o principal;
 * "Tornar principal" leva o contato para o topo. `minimo` = quantos são obrigatórios (0 ou 1).
 */
export function ContatosEditor({
  form,
  minimo,
  rotulo,
}: {
  form: UseFormReturn<ComContatos>
  minimo: 0 | 1
  /** Nome acessível da lista. */
  rotulo: string
}) {
  const { t } = useTranslation()
  const contatos = useFieldArray({ control: form.control, name: 'contatos' })

  return (
    <div className="space-y-3">
      {contatos.fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center type-body text-muted-foreground">
          {t('contatos.nenhum')}
        </p>
      )}
      <ol className="space-y-3" aria-label={rotulo}>
        {contatos.fields.map((f, i) => {
          const n = i + 1
          return (
            <li key={f.id} className="rounded-lg border bg-card p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 type-label">
                  {t('contatos.contatoN', { n })}
                  {i === 0 && <Badge variant="info">{t('contatos.principal')}</Badge>}
                </p>
                <div className="flex items-center gap-1">
                  {i > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => contatos.move(i, 0)}>
                      <Star aria-hidden />
                      {t('contatos.tornarPrincipal')}
                      <span className="sr-only"> ({t('contatos.contatoN', { n })})</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={contatos.fields.length <= minimo}
                    onClick={() => contatos.remove(i)}
                    aria-label={t('contatos.removerN', { n })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,11rem)]">
                <RhfField
                  control={form.control}
                  name={`contatos.${i}.nome`}
                  label={t('contatos.nome')}
                >
                  {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
                </RhfField>
                <RhfField
                  control={form.control}
                  name={`contatos.${i}.email`}
                  label={t('contatos.email')}
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
                  label={t('contatos.telefone')}
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
        {t('contatos.adicionar')}
      </Button>
    </div>
  )
}
