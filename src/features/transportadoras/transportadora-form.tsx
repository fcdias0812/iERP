import { useMemo } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { AsyncCombobox } from '@/components/ui/async-combobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { motoristaBasicoVazio } from '@/features/comum/basicos'
import { CadastroSecao } from '@/features/comum/CadastroSheet'
import { ContatosEditor, type ComContatos } from '@/features/comum/ContatosEditor'
import { formatCpf } from '@/lib/format'
import type { MotoristaResumo } from '@/services/types'
import { MAX_MOTORISTAS_NOVOS, type TransportadoraForm } from './transportadora-schema'
import { useOpcoesMotoristas } from './use-transportadoras'

type Form = UseFormReturn<TransportadoraForm>

/** Busca sem acento e sem caixa. */
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Seções do formulário da transportadora (painel lateral: nova e editar). */
export function TransportadoraFields({ form, id }: { form: Form; id?: string }) {
  const { t } = useTranslation()
  return (
    <>
      <CadastroSecao titulo={t('transportadoras.form.identificacao')}>
        <RhfField
          control={form.control}
          name="nome"
          label={t('transportadoras.cols.nome')}
          required
          maxLength={160}
          className="sm:col-span-2"
        >
          {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
        </RhfField>
        <RhfField
          control={form.control}
          name="cnpj"
          label={t('transportadoras.cols.cnpj')}
          required
        >
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
        titulo={t('transportadoras.form.contatos')}
        descricao={t('transportadoras.form.contatosAjuda')}
        colunas={1}
      >
        <ContatosEditor
          form={form as unknown as UseFormReturn<ComContatos>}
          minimo={0}
          rotulo={t('transportadoras.form.contatos')}
        />
      </CadastroSecao>
      <CadastroSecao
        titulo={t('transportadoras.form.motoristas')}
        descricao={t('transportadoras.form.motoristasAjuda')}
        colunas={1}
      >
        <MotoristasEditor form={form} transportadoraId={id} />
      </CadastroSecao>
    </>
  )
}

/**
 * Motoristas da transportadora: escolher da lista (mostra onde o motorista está hoje — ele muda
 * para esta transportadora ao salvar) ou cadastrar um novo, que também entra em Motoristas.
 */
function MotoristasEditor({ form, transportadoraId }: { form: Form; transportadoraId?: string }) {
  const { t } = useTranslation()
  const vinculados = useFieldArray({ control: form.control, name: 'vinculados', keyName: 'chave' })
  const novos = useFieldArray({ control: form.control, name: 'novosMotoristas' })
  const opcoes = useOpcoesMotoristas()

  // Ainda não vinculados (ativos). Quem está em outra transportadora mostra "hoje em …".
  const ids = new Set(vinculados.fields.map((m) => m.id))
  const filtrar = (l: MotoristaResumo[]) =>
    l.filter(
      (m) => m.status === 'ativo' && !ids.has(m.id) && m.transportadoraId !== transportadoraId,
    )
  const disponiveis = filtrar(opcoes.data ?? [])
  const chave = useMemo(() => [...ids].sort().join(','), [vinculados.fields]) // eslint-disable-line react-hooks/exhaustive-deps
  const rotulo = (m: MotoristaResumo) =>
    [
      m.nome,
      formatCpf(m.cpf),
      m.transportadoraNome
        ? t('transportadoras.form.vinculadoA', { name: m.transportadoraNome })
        : null,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="space-y-4">
      {vinculados.fields.length === 0 && novos.fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center type-body text-muted-foreground">
          {t('transportadoras.form.semMotoristas')}
        </p>
      )}
      {vinculados.fields.length > 0 && (
        <ul
          className="divide-y rounded-lg border"
          aria-label={t('transportadoras.form.motoristas')}
        >
          {vinculados.fields.map((m, i) => (
            <li key={m.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0 flex-1 truncate type-body font-medium">{m.nome}</span>
              <span className="font-mono type-caption text-muted-foreground">
                {formatCpf(m.cpf)}
              </span>
              {m.transportadoraNome && (
                <Badge variant="outline">
                  {t('transportadoras.form.vinculadoA', { name: m.transportadoraNome })}
                </Badge>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t('transportadoras.form.removerMotorista', { name: m.nome })}
                onClick={() => vinculados.remove(i)}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <AsyncCombobox
          // A chave muda quando a lista chega ou muda (senão o combobox guarda "nenhuma opção").
          queryKey={`motoristas-disponiveis-${transportadoraId ?? 'nova'}-${chave}-${opcoes.dataUpdatedAt}`}
          aria-label={t('transportadoras.form.escolherMotorista')}
          placeholder={t('transportadoras.form.escolherMotorista')}
          value={null}
          loadOptions={async (busca) => {
            const q = normalizar(busca)
            // Aberto antes de a lista chegar: espera por ela.
            const lista = opcoes.data ?? (await opcoes.refetch()).data ?? []
            return filtrar(lista)
              .filter((m) => !q || normalizar(`${m.nome} ${m.cpf}`).includes(q))
              .slice(0, 50)
              .map((m) => ({ value: m.id, label: rotulo(m) }))
          }}
          onValueChange={(o) => {
            const m = o && disponiveis.find((x) => x.id === o.value)
            if (m)
              vinculados.append({
                id: m.id,
                nome: m.nome,
                cpf: m.cpf,
                transportadoraNome: m.transportadoraNome,
              })
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={novos.fields.length >= MAX_MOTORISTAS_NOVOS}
          onClick={() => novos.append(motoristaBasicoVazio(), { shouldFocus: true })}
        >
          <UserPlus aria-hidden />
          {t('transportadoras.form.novoMotorista')}
        </Button>
      </div>

      {novos.fields.length > 0 && (
        <ol className="space-y-3" aria-label={t('transportadoras.form.novoMotorista')}>
          {novos.fields.map((f, i) => {
            const n = i + 1
            return (
              <li key={f.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 type-card-title">
                    <Plus aria-hidden className="size-4 text-muted-foreground" />
                    {t('transportadoras.form.motoristaNovoN', { n })}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('transportadoras.form.removerNovoN', { n })}
                    onClick={() => novos.remove(i)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
                  <RhfField
                    control={form.control}
                    name={`novosMotoristas.${i}.nome`}
                    label={t('motoristas.campos.nome')}
                    required
                    maxLength={160}
                  >
                    {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
                  </RhfField>
                  <RhfField
                    control={form.control}
                    name={`novosMotoristas.${i}.cpf`}
                    label={t('motoristas.campos.cpf')}
                    required
                  >
                    {({ field, control }) => (
                      <MaskedInput
                        {...control}
                        kind="cpf"
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    )}
                  </RhfField>
                  <RhfField
                    control={form.control}
                    name={`novosMotoristas.${i}.telefone`}
                    label={t('motoristas.campos.telefone')}
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
      )}
    </div>
  )
}
