import { useContext, useId, useMemo, type ReactNode } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import {
  Controller,
  useFieldArray,
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { AsyncCombobox } from '@/components/ui/async-combobox'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { AttachmentList, FileDropzone } from '@/components/ui/file-upload'
import { RhfField } from '@/components/ui/form'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { TextoTraduzido } from '@/components/ui/localized-text'
import { MaskedInput, NumberInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import type { StatusId } from '@/lib/status/statusMap'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { EXTENSOES_DOCUMENTO, MAX_BYTES_DOCUMENTO } from '@/features/clientes/detalhe/documentos'
import { CadastroSecao } from '@/features/comum/CadastroSheet'
import { useOpcoesTransportadoras } from '@/features/motoristas/use-motoristas'
import { useOpcoesMotoristas } from '@/features/transportadoras/use-transportadoras'
import { formatCnpj } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  caminhaoTravado,
  NENHUM,
  novoCaminhao,
  QUANTIDADES,
  SERVICOS,
  type AgendamentoForm,
} from './agendamento-schema'
import { useRegrasDoCliente } from './regras-do-cliente'
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
  // Página: o mesmo visual do FormSection, mas pelo espaço da PRÓPRIA seção (container query) —
  // com o card de pré-cálculo ao lado, a largura da tela não diz quanto sobra (ficava espremido).
  return (
    <div className="@container">
      <section className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 shadow-card @3xl:grid-cols-[16rem_minmax(0,1fr)] @3xl:gap-8 @3xl:p-6">
        <div className="space-y-1">
          <h2 className="type-card-title">{titulo}</h2>
          {descricao && <p className="type-body text-muted-foreground">{descricao}</p>}
        </div>
        <div className="@container/campos min-w-0">
          <div
            className={cn(
              'grid grid-cols-1 content-start gap-x-4 gap-y-5',
              colunas === 2 && '@md/campos:grid-cols-2',
            )}
          >
            {children}
          </div>
        </div>
      </section>
    </div>
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
  const regras = useRegrasDoCliente(form)

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
        className="col-span-full"
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
      {/* Aba Configurações do cliente: bloqueio (só no agendamento novo) e instruções. */}
      {!clienteFixo && regras?.agendamentoBloqueado && (
        <Alert
          tone="inactive"
          title={t('clientes.config.bloqueadoTitulo')}
          className="col-span-full"
        >
          {regras.bloqueioMotivo}
        </Alert>
      )}
      {regras?.instrucoes && (
        <Alert
          tone="info"
          title={t('ordens.agendamento.cliente.instrucoes')}
          className="col-span-full"
        >
          <TextoTraduzido valor={regras.instrucoes} className="whitespace-pre-line" />
        </Alert>
      )}
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
  const regras = useRegrasDoCliente(form)
  const prevista = useWatch({ control: form.control, name: 'coletaPrevista' })
  // Antecedência mínima do cliente: só avisa (decisão do usuário, 22/10/2026).
  const antecedencia = regras?.antecedenciaDias ?? null
  const curta =
    antecedencia !== null && prevista
      ? differenceInCalendarDays(prevista, new Date()) < antecedencia
      : false
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
      {data('coletaPrevista', {
        required: true,
        help: t('ordens.agendamento.ajuda.coletaPrevista'),
      })}
      {curta && (
        <Alert
          tone="warning"
          title={t('ordens.agendamento.cliente.antecedencia', { n: antecedencia })}
          className="col-span-full"
        />
      )}
      {data('dataColeta', { help: t('ordens.agendamento.ajuda.dataColeta') })}
      {data('dataChegada')}
    </Secao>
  )
}

/* ------------------------------------------------------------ rastreio */

export function Rastreio({ form }: { form: Form }) {
  const { t } = useTranslation()
  const rastrear = useWatch({ control: form.control, name: 'rastrear' })
  const regras = useRegrasDoCliente(form)
  // Sem exceção, o rastreio é o do cliente (aba Configurações).
  const fixo = Boolean(regras && !regras.rastreioExcecao)
  const exigir = Boolean(regras?.exigirMotoristaPlaca)
  const motoristas = useOpcoesMotoristas()
  const ativos = (motoristas.data ?? []).filter((m) => m.status === 'ativo')
  // Vários caminhões na mesma coleta (22/10/2026): um por viagem.
  const lista = useFieldArray({ control: form.control, name: 'caminhoes' })
  const caminhoes = useWatch({ control: form.control, name: 'caminhoes' })
  return (
    <Secao
      titulo={t('ordens.agendamento.secoes.rastreio')}
      descricao={t('ordens.agendamento.secoesAjuda.rastreio')}
      colunas={1}
    >
      <SimNao
        form={form}
        name="rastrear"
        label={t('ordens.agendamento.campos.rastrear')}
        travado={fixo}
        help={fixo ? t('ordens.agendamento.cliente.rastreioFixo') : undefined}
      />
      {rastrear && (
        <div className="flex flex-col gap-3">
          {lista.fields.map((f, i) => {
            const c = caminhoes[i] ?? f
            const travado = caminhaoTravado(c)
            return (
              <fieldset
                key={f.id}
                className="grid grid-cols-1 items-start gap-3 rounded-md border p-3 @md/campos:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]"
              >
                <legend className="flex items-center gap-2 px-1 type-label">
                  {t('ordens.agendamento.caminhoes.titulo', { n: i + 1 })}
                  {travado && c.status && (
                    <StatusBadge status={`viagem_${c.status}` as StatusId} size="sm" />
                  )}
                </legend>
                <RhfField
                  control={form.control}
                  name={`caminhoes.${i}.motoristaId`}
                  label={t('ordens.agendamento.campos.motorista')}
                  required={exigir}
                >
                  {({ field, control }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={travado}>
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
                  name={`caminhoes.${i}.placa`}
                  label={t('ordens.agendamento.campos.placa')}
                  required={exigir}
                >
                  {({ field, control }) => (
                    <MaskedInput
                      {...control}
                      kind="plate"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      readOnly={travado}
                    />
                  )}
                </RhfField>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  aria-label={t('ordens.agendamento.caminhoes.remover', { n: i + 1 })}
                  disabled={travado || lista.fields.length === 1}
                  onClick={() => lista.remove(i)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </fieldset>
            )
          })}
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={lista.fields.length >= 20}
            onClick={() => lista.append(novoCaminhao())}
          >
            <Plus aria-hidden />
            {t('ordens.agendamento.caminhoes.adicionar')}
          </Button>
        </div>
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
        <div className="col-span-full">
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
      {requerVazios &&
        numero('quantidades.palletsVazios', t('ordens.agendamento.campos.palletsVazios'), {
          required: true,
        })}
      <SimNao
        form={form}
        name="quantidades.itensMais25kg"
        label={t('ordens.agendamento.campos.itensMais25kg')}
        className="col-start-1"
      />
      <RhfField
        control={form.control}
        name="quantidades.fatorLimitante"
        label={t('ordens.agendamento.campos.fatorLimitante')}
        help={t('ordens.agendamento.ajuda.fatorLimitante')}
        maxLength={1000}
        className="col-span-full"
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
  const regras = useRegrasDoCliente(form)
  const planilha = obrigatorio && !semArquivos && regras?.exigirEscopoPlanilha
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
          planilha
            ? t('ordens.agendamento.cliente.escopoPlanilha')
            : obrigatorio
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
  className,
  travado,
  help,
}: {
  form: Form
  name: Extract<
    FieldPath<AgendamentoForm>,
    'rastrear' | 'quantidades.requerPalletsVazios' | 'quantidades.itensMais25kg'
  >
  label: string
  className?: string
  /** Não se muda aqui (vem de outro lugar — ex.: configurações do cliente). */
  travado?: boolean
  help?: string
}) {
  const { t } = useTranslation()
  return (
    <RhfField control={form.control} name={name} label={label} help={help} className={className}>
      {({ field, control }) => (
        <div className="flex h-control items-center gap-2">
          <Switch
            {...control}
            disabled={travado}
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
