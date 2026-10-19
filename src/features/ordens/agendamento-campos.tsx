import { useContext, useId, useMemo, type ReactNode } from 'react'
import { Controller, useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormSection } from '@/components/patterns/FormPage'
import { AsyncCombobox } from '@/components/ui/async-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { AttachmentList, FileDropzone } from '@/components/ui/file-upload'
import { RhfField } from '@/components/ui/form'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { MaskedInput, NumberInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EXTENSOES_DOCUMENTO, MAX_BYTES_DOCUMENTO } from '@/features/clientes/detalhe/documentos'
import { CadastroSecao } from '@/features/comum/CadastroSheet'
import { useOpcoesTransportadoras } from '@/features/motoristas/use-motoristas'
import { useOpcoesMotoristas } from '@/features/transportadoras/use-transportadoras'
import { formatCnpj } from '@/lib/format'
import { NENHUM, QUANTIDADES, SERVICOS, type AgendamentoForm } from './agendamento-schema'
import { SecaoContexto } from './secao-contexto'
import { buscarClientesAtivos, useSitesDoCliente } from './use-ordens'

/*
 * Campos do agendamento, usados em dois lugares: a página Ordens › Agendamento (cria o lote) e o
 * painel de edição do lote (detalhe do lote, só enquanto agendado). A moldura de cada seção vem
 * do contexto: FormSection na página, CadastroSecao no painel.
 */

type Form = UseFormReturn<AgendamentoForm>

interface SecaoProps {
  titulo: string
  descricao?: string
  colunas?: 1 | 2
  children: ReactNode
}

function Secao({ titulo, descricao, colunas = 2, children }: SecaoProps) {
  if (useContext(SecaoContexto) === 'painel')
    return (
      <CadastroSecao titulo={titulo} descricao={descricao} colunas={colunas}>
        {children}
      </CadastroSecao>
    )
  return (
    <FormSection title={titulo} description={descricao} columns={colunas}>
      {children}
    </FormSection>
  )
}

/* ------------------------------------------------------------ cliente, site e doca */

export function Local({ form, clienteFixo }: { form: Form; clienteFixo?: boolean }) {
  const { t } = useTranslation()
  const [clienteId, clienteNome, siteId] = useWatch({
    control: form.control,
    name: ['clienteId', 'clienteNome', 'siteId'],
  })
  const sites = useSitesDoCliente(clienteId)
  const site = sites.data?.find((s) => s.id === siteId)
  const semSites = Boolean(clienteId) && sites.isSuccess && sites.data.length === 0

  return (
    <Secao
      titulo={t('ordens.agendamento.secoes.local')}
      descricao={t('ordens.agendamento.secoesAjuda.local')}
    >
      <RhfField
        control={form.control}
        name="clienteId"
        label={t('ordens.agendamento.campos.cliente')}
        required
        help={clienteFixo ? t('lotes.editar.clienteFixo') : undefined}
        className="sm:col-span-2"
      >
        {({ field, control }) =>
          clienteFixo ? (
            <Input {...control} value={clienteNome} readOnly />
          ) : (
            <AsyncCombobox
              {...control}
              queryKey="agendamento-clientes"
              loadOptions={buscarClientesAtivos}
              placeholder={t('ordens.agendamento.ajuda.buscarCliente')}
              value={field.value ? { value: field.value, label: clienteNome } : null}
              onValueChange={(o) => {
                field.onChange(o?.value ?? '')
                form.setValue('clienteNome', o?.label ?? '')
                // Trocar o cliente limpa site e doca.
                form.setValue('siteId', '')
                form.setValue('docaId', '')
                field.onBlur()
              }}
            />
          )
        }
      </RhfField>
      <RhfField
        control={form.control}
        name="siteId"
        label={t('ordens.agendamento.campos.site')}
        required
        help={
          !clienteId
            ? t('ordens.agendamento.ajuda.escolhaCliente')
            : semSites
              ? t('ordens.agendamento.ajuda.semSites')
              : undefined
        }
      >
        {({ field, control }) => (
          <Select
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v)
              form.setValue('docaId', '')
            }}
            disabled={!clienteId || semSites}
          >
            <SelectTrigger {...control} onBlur={field.onBlur}>
              <SelectValue placeholder={t('field.selectOne')} />
            </SelectTrigger>
            <SelectContent>
              {(sites.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </RhfField>
      <RhfField
        control={form.control}
        name="docaId"
        label={t('ordens.agendamento.campos.doca')}
        required
        help={
          !siteId
            ? t('ordens.agendamento.ajuda.escolhaSite')
            : site && !site.docas.length
              ? t('ordens.agendamento.ajuda.semDocas')
              : undefined
        }
      >
        {({ field, control }) => (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={!site || !site.docas.length}
          >
            <SelectTrigger {...control} onBlur={field.onBlur}>
              <SelectValue placeholder={t('field.selectOne')} />
            </SelectTrigger>
            <SelectContent>
              {(site?.docas ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {t('ordens.agendamento.ajuda.doca', { numero: d.numero })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </RhfField>
    </Secao>
  )
}

/* ------------------------------------------------------------ coleta */

export function Coleta({ form }: { form: Form }) {
  const { t } = useTranslation()
  const transportadoras = useOpcoesTransportadoras()
  const ativas = (transportadoras.data ?? []).filter((x) => x.status === 'ativo')
  const data = (
    name: 'dataColeta' | 'coletaPrevista' | 'dataChegada',
    extra: { help?: string; required?: boolean } = {},
  ) => (
    <RhfField
      control={form.control}
      name={name}
      label={t(`ordens.agendamento.campos.${name}`)}
      {...extra}
    >
      {({ field, control }) => (
        <DatePicker {...control} value={field.value} onValueChange={field.onChange} />
      )}
    </RhfField>
  )
  return (
    <Secao titulo={t('ordens.agendamento.secoes.coleta')}>
      <RhfField
        control={form.control}
        name="transportadoraId"
        label={t('ordens.agendamento.campos.transportadora')}
      >
        {({ field, control }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>
                {t('ordens.agendamento.ajuda.nenhumaTransportadora')}
              </SelectItem>
              {ativas.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {`${x.nome} · ${formatCnpj(x.cnpj)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </RhfField>
      <RhfField
        control={form.control}
        name="referenciaCliente"
        label={t('ordens.agendamento.campos.referenciaCliente')}
        maxLength={60}
      >
        {({ field, control }) => (
          <Input {...control} {...field} autoComplete="off" className="font-mono" />
        )}
      </RhfField>
      {data('dataColeta', { required: true })}
      {data('coletaPrevista', { help: t('ordens.agendamento.ajuda.coletaPrevista') })}
      {data('dataChegada')}
    </Secao>
  )
}

/* ------------------------------------------------------------ rastreio */

export function Rastreio({ form }: { form: Form }) {
  const { t } = useTranslation()
  const rastrear = useWatch({ control: form.control, name: 'rastrear' })
  const motoristas = useOpcoesMotoristas()
  const ativos = (motoristas.data ?? []).filter((m) => m.status === 'ativo')
  return (
    <Secao
      titulo={t('ordens.agendamento.secoes.rastreio')}
      descricao={t('ordens.agendamento.secoesAjuda.rastreio')}
    >
      <SimNao form={form} name="rastrear" label={t('ordens.agendamento.campos.rastrear')} />
      {rastrear && (
        <>
          <RhfField
            control={form.control}
            name="motoristaId"
            label={t('ordens.agendamento.campos.motorista')}
            className="sm:col-start-1"
          >
            {({ field, control }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUM}>
                    {t('ordens.agendamento.ajuda.nenhumMotorista')}
                  </SelectItem>
                  {ativos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.transportadoraNome ? `${m.nome} · ${m.transportadoraNome}` : m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </RhfField>
          <RhfField
            control={form.control}
            name="placa"
            label={t('ordens.agendamento.campos.placa')}
          >
            {({ field, control }) => (
              <MaskedInput
                {...control}
                kind="plate"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          </RhfField>
        </>
      )}
    </Secao>
  )
}

/* ------------------------------------------------------------ serviços */

export function Servicos({ form }: { form: Form }) {
  const { t } = useTranslation()
  const grupo = useId()
  return (
    <Secao
      titulo={t('ordens.agendamento.secoes.servicos')}
      descricao={t('ordens.agendamento.secoesAjuda.servicos')}
      colunas={1}
    >
      <div role="group" aria-labelledby={grupo} className="flex flex-col gap-3">
        <span id={grupo} className="sr-only">
          {t('ordens.agendamento.secoes.servicos')}
        </span>
        {SERVICOS.map((s) => (
          <Controller
            key={s}
            control={form.control}
            name={`servicos.${s}`}
            render={({ field }) => (
              <label className="flex min-h-6 items-center gap-2 type-body">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(c) => {
                    field.onChange(c === true)
                    // Placas de policarbonato dependem do serviço IV.
                    if (s === 'valueRecoveryRacks' && form.formState.isSubmitted)
                      void form.trigger('quantidades')
                  }}
                />
                {t(`ordens.agendamento.servicos.${s}`)}
              </label>
            )}
          />
        ))}
      </div>
    </Secao>
  )
}

/* ------------------------------------------------------------ quantidades */

export function Quantidades({ form }: { form: Form }) {
  const { t } = useTranslation()
  const [racks, requerVazios] = useWatch({
    control: form.control,
    name: ['servicos.valueRecoveryRacks', 'quantidades.requerPalletsVazios'],
  })
  const numero = (
    name: `quantidades.${'boxes' | 'pallets' | 'gaylords' | 'racks' | 'placasPolicarbonato' | 'palletsVazios'}`,
    label: string,
    extra: { required?: boolean; help?: string } = {},
  ) => (
    <RhfField control={form.control} name={name} label={label} {...extra}>
      {({ field, control }) => (
        <NumberInput
          {...control}
          value={field.value ?? null}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          scale={0}
          min={0}
        />
      )}
    </RhfField>
  )
  return (
    <Secao titulo={t('ordens.agendamento.secoes.quantidades')}>
      {QUANTIDADES.map((q) => (
        <div key={q}>{numero(`quantidades.${q}`, t(`ordens.agendamento.campos.${q}`))}</div>
      ))}
      {racks && (
        <div className="sm:col-span-2">
          {numero(
            'quantidades.placasPolicarbonato',
            t('ordens.agendamento.campos.placasPolicarbonato'),
            { required: true, help: t('ordens.agendamento.ajuda.placas') },
          )}
        </div>
      )}
      <SimNao
        form={form}
        name="quantidades.requerPalletsVazios"
        label={t('ordens.agendamento.campos.requerPalletsVazios')}
      />
      {requerVazios ? (
        numero('quantidades.palletsVazios', t('ordens.agendamento.campos.palletsVazios'), {
          required: true,
        })
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      <SimNao
        form={form}
        name="quantidades.itensMais25kg"
        label={t('ordens.agendamento.campos.itensMais25kg')}
      />
      <RhfField
        control={form.control}
        name="quantidades.fatorLimitante"
        label={t('ordens.agendamento.campos.fatorLimitante')}
        help={t('ordens.agendamento.ajuda.fatorLimitante')}
        maxLength={1000}
        className="sm:col-span-2"
      >
        {({ field, control }) => <Textarea {...control} {...field} rows={2} />}
      </RhfField>
    </Secao>
  )
}

/* ------------------------------------------------------------ anexos da OS */

/** Anexos da OS (escopo e observações) numa seção. `semArquivos`: só o texto (edição). */
export function Anexos({ form, semArquivos }: { form: Form; semArquivos?: boolean }) {
  const { t } = useTranslation()
  return (
    <Secao
      titulo={t('ordens.agendamento.secoes.anexos')}
      descricao={
        semArquivos ? t('lotes.editar.anexosAjuda') : t('ordens.agendamento.secoesAjuda.anexos')
      }
      colunas={1}
    >
      <Anexo
        form={form}
        texto="escopo"
        arquivos="escopoArquivos"
        obrigatorio
        semArquivos={semArquivos}
      />
      <Anexo
        form={form}
        texto="observacoes"
        arquivos="observacoesArquivos"
        semArquivos={semArquivos}
      />
    </Secao>
  )
}

function Anexo({
  form,
  texto,
  arquivos,
  obrigatorio,
  semArquivos,
}: {
  form: Form
  texto: 'escopo' | 'observacoes'
  arquivos: 'escopoArquivos' | 'observacoesArquivos'
  obrigatorio?: boolean
  semArquivos?: boolean
}) {
  const { t } = useTranslation()
  const lista = useWatch({ control: form.control, name: arquivos })
  const itens = useMemo(
    () => lista.map((f, i) => ({ id: String(i), name: f.name, size: f.size })),
    [lista],
  )
  const mudar = (novos: File[]) => {
    form.setValue(arquivos, novos, { shouldDirty: true })
    // O escopo vale com texto OU arquivo: revalida o campo de texto.
    if (form.formState.isSubmitted || form.getFieldState(texto).isTouched) void form.trigger(texto)
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
      <legend className="px-1 type-card-title">{t(`ordens.agendamento.campos.${texto}`)}</legend>
      <RhfField
        control={form.control}
        name={texto}
        label={t('ordens.agendamento.campos.texto')}
        required={obrigatorio}
        help={
          obrigatorio
            ? t(semArquivos ? 'lotes.editar.escopoAjuda' : 'ordens.agendamento.ajuda.escopo')
            : undefined
        }
        maxLength={5000}
      >
        {({ field, control }) => <Textarea {...control} {...field} rows={3} />}
      </RhfField>
      {!semArquivos && (
        <FormField label={t('ordens.agendamento.campos.arquivos')}>
          {(c) => (
            <div className="flex flex-col gap-2">
              <FileDropzone
                id={c.id}
                aria-describedby={c['aria-describedby']}
                accept={EXTENSOES_DOCUMENTO.map((x) => `.${x}`).join(',')}
                maxSize={MAX_BYTES_DOCUMENTO}
                onFiles={(files) => mudar([...lista, ...files])}
              />
              {itens.length > 0 && (
                <AttachmentList
                  items={itens}
                  onRemove={(id) => mudar(lista.filter((_, i) => String(i) !== id))}
                />
              )}
            </div>
          )}
        </FormField>
      )}
    </fieldset>
  )
}

/* ------------------------------------------------------------ sim/não */

function SimNao({
  form,
  name,
  label,
}: {
  form: Form
  name: Extract<
    FieldPath<AgendamentoForm>,
    'rastrear' | 'quantidades.requerPalletsVazios' | 'quantidades.itensMais25kg'
  >
  label: string
}) {
  const { t } = useTranslation()
  return (
    <RhfField control={form.control} name={name} label={label}>
      {({ field, control }) => (
        <div className="flex h-control items-center gap-2">
          <Switch
            {...control}
            checked={Boolean(field.value)}
            onCheckedChange={(v) => {
              field.onChange(v)
              field.onBlur()
            }}
          />
          <span className="type-body" aria-hidden>
            {field.value ? t('dataTable.yes') : t('dataTable.no')}
          </span>
        </div>
      )}
    </RhfField>
  )
}
