import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Crosshair, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput, NumberInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/lib/api-errors'
import { buscarCep, localizarEndereco } from '@/services/geo'
import type { ContatoCliente, SiteCliente } from '@/services/types'
import { isCodigoSiteEmUso, useSalvarSite } from '../use-clientes'
import {
  docaVazia,
  escreverCoordenadas,
  formParaInput,
  lerCoordenadas,
  MAX_DOCAS,
  NENHUM,
  novoSiteForm,
  NOVO_CONTATO,
  siteParaForm,
  siteSchema,
  type SiteForm,
} from './site-schema'

const MapaSite = lazy(() => import('./MapaSite'))

type Form = UseFormReturn<SiteForm>

/**
 * Cadastrar/editar site do cliente — painel lateral (sem sair da aba Logística).
 * CEP preenche endereço e região e já marca o ponto no mapa; o pino pode ser arrastado.
 */
export function SiteSheet({
  clienteId,
  contatos,
  site,
  open,
  onOpenChange,
}: {
  clienteId: string
  contatos: ContatoCliente[]
  /** Site a editar (undefined = novo). */
  site?: SiteCliente
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [descartar, setDescartar] = useState(false)
  const salvar = useSalvarSite(clienteId, site?.id)
  const form = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    mode: 'onTouched',
    values: site ? siteParaForm(site) : novoSiteForm(),
    resetOptions: { keepDirtyValues: false },
  })

  const fechar = (forcar = false) => {
    if (!forcar && form.formState.isDirty) setDescartar(true)
    else onOpenChange(false)
  }

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar.mutateAsync(formParaInput(siteSchema.parse(v))).catch((e) => {
      if (isCodigoSiteEmUso(e))
        form.setError('codigo', { message: t('apiErrors.siteCodeInUse') }, { shouldFocus: true })
      return null
    })
    if (salvo) {
      form.reset(siteParaForm(salvo))
      onOpenChange(false)
    }
  })

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : fechar())}>
        <SheetContent className="w-full gap-0 sm:max-w-3xl">
          <SheetHeader className="border-b">
            <SheetTitle>
              {site
                ? t('clientes.sites.editTitle', { code: site.codigo })
                : t('clientes.sites.newTitle')}
            </SheetTitle>
            <SheetDescription>{t('clientes.sites.formDescription')}</SheetDescription>
          </SheetHeader>
          <form
            id="form-site"
            noValidate
            className="flex flex-1 flex-col gap-6 overflow-y-auto p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void enviar()
            }}
          >
            <Secao titulo={t('clientes.sites.secoes.identificacao')}>
              <RhfField
                control={form.control}
                name="codigo"
                label={t('clientes.sites.campos.codigo')}
                required
                maxLength={30}
              >
                {({ field, control }) => (
                  <Input {...control} {...field} placeholder="SPO-01" autoComplete="off" />
                )}
              </RhfField>
              <RhfField
                control={form.control}
                name="regiao"
                label={t('clientes.sites.campos.regiao')}
              >
                {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
              </RhfField>
              <RhfField
                control={form.control}
                name="horario"
                label={t('clientes.sites.campos.horario')}
                maxLength={120}
              >
                {({ field, control }) => (
                  <Input
                    {...control}
                    {...field}
                    placeholder={t('clientes.sites.horarioExemplo')}
                    autoComplete="off"
                  />
                )}
              </RhfField>
              <RhfField
                control={form.control}
                name="totalGaylords"
                label={t('clientes.sites.campos.totalGaylords')}
              >
                {({ field, control }) => (
                  <NumberInput
                    {...control}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    min={0}
                  />
                )}
              </RhfField>
            </Secao>

            <Secao titulo={t('clientes.sites.secoes.localizacao')} colunas={1}>
              <Localizacao form={form} />
            </Secao>

            <Secao titulo={t('clientes.sites.secoes.estrutura')}>
              <SimNao
                form={form}
                name="shredderProprio"
                label={t('clientes.sites.campos.shredderProprio')}
              />
              <SimNao form={form} name="edgeSite" label={t('clientes.sites.campos.edgeSite')} />
            </Secao>

            <Secao titulo={t('clientes.sites.secoes.responsavel')}>
              <Responsavel form={form} contatos={contatos} />
            </Secao>

            <Secao titulo={t('clientes.sites.secoes.docas')} colunas={1}>
              <Docas form={form} />
            </Secao>
          </form>
          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button variant="secondary" onClick={() => fechar()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="form-site" loading={form.formState.isSubmitting}>
              {t('common.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={descartar}
        onOpenChange={setDescartar}
        variant="destructive"
        title={t('patterns.unsaved.title')}
        description={t('patterns.unsaved.description')}
        confirmLabel={t('patterns.unsaved.leave')}
        onConfirm={() => {
          form.reset()
          onOpenChange(false)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------ partes do formulário */

function Secao({
  titulo,
  colunas = 2,
  children,
}: {
  titulo: string
  colunas?: 1 | 2
  children: ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 type-card-title">{titulo}</legend>
      <div
        className={
          colunas === 2
            ? 'grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2'
            : 'grid grid-cols-1 gap-4'
        }
      >
        {children}
      </div>
    </fieldset>
  )
}

function SimNao({
  form,
  name,
  label,
}: {
  form: Form
  name:
    | 'shredderProprio'
    | 'edgeSite'
    | `docas.${number}.${'dockLeveler' | 'tailLift' | 'pisoProtecaoObrigatorio'}`
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

/** CEP, endereço e mapa. CEP → endereço/região → ponto no mapa (1 clique). */
function Localizacao({ form }: { form: Form }) {
  const { t } = useTranslation()
  const [buscando, setBuscando] = useState<'cep' | 'mapa' | null>(null)
  const coordenadas = useWatch({ control: form.control, name: 'coordenadas' })
  const posicao = lerCoordenadas(coordenadas ?? '') ?? null

  const marcar = (lat: number, lng: number) =>
    form.setValue('coordenadas', escreverCoordenadas(lat, lng), {
      shouldDirty: true,
      shouldValidate: true,
    })

  async function localizar(endereco: string) {
    if (endereco.trim().length < 5) return
    setBuscando('mapa')
    try {
      const r = await localizarEndereco(endereco)
      marcar(r.latitude, r.longitude)
      // Só achou a cidade: o ponto é o centro dela — pedir para arrastar o pino.
      if (r.precisao === 'cidade') toast.warning(t('clientes.sites.mapa.aproximado'))
    } catch (e) {
      toast.error(t('clientes.sites.mapa.naoAchou'), { description: apiErrorMessage(e) })
    } finally {
      setBuscando(null)
    }
  }

  async function porCep() {
    const cep = form.getValues('cep')
    if (cep.replace(/\D/g, '').length !== 8) {
      form.setError('cep', { message: 'validation.cep' })
      return
    }
    setBuscando('cep')
    try {
      const r = await buscarCep(cep)
      form.setValue('endereco', r.endereco, { shouldDirty: true })
      if (!form.getValues('regiao') && r.regiao)
        form.setValue('regiao', r.regiao, { shouldDirty: true })
      setBuscando(null)
      await localizar(r.endereco)
    } catch (e) {
      setBuscando(null)
      toast.error(t('clientes.sites.mapa.cepNaoAchou'), { description: apiErrorMessage(e) })
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 items-end gap-x-4 gap-y-4 sm:grid-cols-[12rem_auto_minmax(0,1fr)]">
        <RhfField control={form.control} name="cep" label={t('clientes.sites.campos.cep')}>
          {({ field, control }) => (
            <MaskedInput
              {...control}
              kind="cep"
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void porCep()
                }
              }}
            />
          )}
        </RhfField>
        <Button
          variant="secondary"
          className="self-start sm:mt-6"
          loading={buscando === 'cep'}
          onClick={() => void porCep()}
        >
          <Search aria-hidden />
          {t('clientes.sites.buscarCep')}
        </Button>
      </div>
      <RhfField
        control={form.control}
        name="endereco"
        label={t('clientes.sites.campos.endereco')}
        maxLength={300}
      >
        {({ field, control }) => (
          <Input
            {...control}
            {...field}
            placeholder={t('clientes.sites.enderecoExemplo')}
            autoComplete="off"
          />
        )}
      </RhfField>
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <MapaSite
          posicao={posicao}
          rotulo={t('clientes.sites.mapa.rotulo')}
          onChange={(p) => marcar(p.lat, p.lng)}
        />
      </Suspense>
      <p className="type-caption text-muted-foreground">{t('clientes.sites.mapa.ajuda')}</p>
      <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <RhfField
          control={form.control}
          name="coordenadas"
          label={t('clientes.sites.campos.coordenadas')}
          help={t('clientes.sites.coordenadasAjuda')}
        >
          {({ field, control }) => (
            <Input
              {...control}
              {...field}
              placeholder="-22.858400, -47.220100"
              className="font-mono num"
              autoComplete="off"
            />
          )}
        </RhfField>
        <Button
          variant="secondary"
          className="sm:mt-6"
          loading={buscando === 'mapa'}
          onClick={() => void localizar(form.getValues('endereco'))}
        >
          <Crosshair aria-hidden />
          {t('clientes.sites.localizar')}
        </Button>
      </div>
    </>
  )
}

/** Responsável: contato existente, nenhum, ou um contato novo (entra na lista de contatos). */
function Responsavel({ form, contatos }: { form: Form; contatos: ContatoCliente[] }) {
  const { t } = useTranslation()
  const escolha = useWatch({ control: form.control, name: 'responsavel' })
  return (
    <>
      <RhfField
        control={form.control}
        name="responsavel"
        label={t('clientes.sites.campos.responsavel')}
        className="sm:col-span-2"
      >
        {({ field, control }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>{t('clientes.sites.semResponsavel')}</SelectItem>
              {contatos.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.nome ? `${k.nome} · ${k.email}` : k.email}
                </SelectItem>
              ))}
              <SelectItem value={NOVO_CONTATO}>{t('clientes.sites.novoContato')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </RhfField>
      {escolha === NOVO_CONTATO && (
        <>
          <p className="type-caption text-muted-foreground sm:col-span-2">
            {t('clientes.sites.novoContatoAjuda')}
          </p>
          <RhfField
            control={form.control}
            name="novoContato.nome"
            label={t('clientes.form.contactName')}
            maxLength={120}
          >
            {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
          </RhfField>
          <RhfField
            control={form.control}
            name="novoContato.email"
            label={t('clientes.form.email')}
            required
          >
            {({ field, control }) => (
              <Input {...control} {...field} type="email" autoComplete="off" spellCheck={false} />
            )}
          </RhfField>
          <RhfField
            control={form.control}
            name="novoContato.telefone"
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
        </>
      )}
    </>
  )
}

/** Docas do site (zero ou mais). */
function Docas({ form }: { form: Form }) {
  const { t } = useTranslation()
  const docas = useFieldArray({ control: form.control, name: 'docas' })
  const numero = (
    i: number,
    campo:
      | 'alturaMaxCaminhao'
      | 'comprimentoMaxCaminhao'
      | 'areaLift'
      | 'espaco'
      | 'altura'
      | 'voltagemShredder',
    label: string,
    sufixo: string,
    opcoes: { required?: boolean; scale?: number } = {},
  ) => (
    <RhfField
      control={form.control}
      name={`docas.${i}.${campo}`}
      label={label}
      required={opcoes.required}
    >
      {({ field, control }) => (
        <NumberInput
          {...control}
          value={field.value ?? null}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          scale={opcoes.scale ?? 2}
          min={0}
          suffix={sufixo}
        />
      )}
    </RhfField>
  )

  return (
    <div className="flex flex-col gap-3">
      {docas.fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center type-body text-muted-foreground">
          {t('clientes.sites.semDocas')}
        </p>
      )}
      <ol className="flex flex-col gap-3" aria-label={t('clientes.sites.secoes.docas')}>
        {docas.fields.map((f, i) => (
          <li key={f.id} className="rounded-lg border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="type-label">{t('clientes.sites.docaN', { n: i + 1 })}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => docas.remove(i)}
                aria-label={t('clientes.sites.removerDoca', { n: i + 1 })}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2">
              <RhfField
                control={form.control}
                name={`docas.${i}.numero`}
                label={t('clientes.sites.campos.numeroDoca')}
                required
                maxLength={20}
              >
                {({ field, control }) => (
                  <Input {...control} {...field} placeholder="D1" autoComplete="off" />
                )}
              </RhfField>
              {numero(i, 'alturaMaxCaminhao', t('clientes.sites.campos.alturaMaxCaminhao'), 'm', {
                required: true,
              })}
              {numero(
                i,
                'comprimentoMaxCaminhao',
                t('clientes.sites.campos.comprimentoMaxCaminhao'),
                'm',
              )}
              <SimNao
                form={form}
                name={`docas.${i}.dockLeveler`}
                label={t('clientes.sites.campos.dockLeveler')}
              />
              <SimNao
                form={form}
                name={`docas.${i}.tailLift`}
                label={t('clientes.sites.campos.tailLift')}
              />
              {numero(i, 'areaLift', t('clientes.sites.campos.areaLift'), 'm²')}
              {numero(i, 'espaco', t('clientes.sites.campos.espaco'), 'm²')}
              {numero(i, 'altura', t('clientes.sites.campos.altura'), 'm')}
              {numero(i, 'voltagemShredder', t('clientes.sites.campos.voltagemShredder'), 'V', {
                scale: 0,
              })}
              <SimNao
                form={form}
                name={`docas.${i}.pisoProtecaoObrigatorio`}
                label={t('clientes.sites.campos.pisoProtecaoObrigatorio')}
              />
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={docas.fields.length >= MAX_DOCAS}
        onClick={() => docas.append(docaVazia())}
      >
        <Plus aria-hidden />
        {t('clientes.sites.adicionarDoca')}
      </Button>
    </div>
  )
}
