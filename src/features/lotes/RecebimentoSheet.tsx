import { useState } from 'react'
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { EMPTY_QUERY } from '@/components/data-table/types'
import { Alert } from '@/components/ui/alert'
import { AsyncCombobox } from '@/components/ui/async-combobox'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SeletorIdiomaTexto, TextoTraduzido } from '@/components/ui/localized-text'
import { NumberInput } from '@/components/ui/masked-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCliente } from '@/features/clientes/use-clientes'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { useSalvarRecebimento } from '@/features/ordens/use-ordens'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { EMPTY, formatDate, formatNumber } from '@/lib/format'
import { textoOriginal } from '@/lib/localized-text'
import { listarOrdens, obterOrdem, ordensKeys, urlFotoRecebimento } from '@/services/ordens'
import type { FotosRecebimento, InspecaoVisual, Ordem, RecebimentoInput } from '@/services/types'
import { CampoFotos } from './CampoFotos'
import { etiquetasDosPallets, type EtiquetaPallet } from './etiquetas-pallet'
import { EtiquetasDoRecebimento } from './EtiquetasPallet'
import {
  formParaEnvio,
  INSPECOES,
  MAX_DESCRICAO,
  MAX_FOTOS_GERAIS,
  MAX_FOTOS_ITEM,
  novoLacre,
  novoPallet,
  novoRecebimento,
  recebimentoParaForm,
  recebimentoSchema,
  type RecebimentoForm,
} from './recebimento-schema'
import { CodigoDeChegada } from '@/features/viagens/CodigoDeChegada'
import { StatusDoLote } from './StatusDoLote'

/*
 * Receber lote / corrigir recebimento (painel lateral — padrão de cadastro; decisão do usuário).
 * Receber: só lotes AGENDADOS; ao salvar, o lote vai para Inspeção. Corrigir: só enquanto o lote
 * está em Inspeção. Avaria/Outro pedem descrição, que vira ocorrência de Recebimento no lote.
 */

type Form = UseFormReturn<RecebimentoForm>

/** O recebimento montado para a API (gravado na hora ou depois das etiquetas). */
interface Pedido {
  v: RecebimentoForm
  ordemId: string
  dados: RecebimentoInput
  fotos: FotosRecebimento
}

/** O que a aba Configurações do cliente pode exigir no recebimento (o servidor confere igual). */
type Exigencia = 'lacre' | 'nota' | 'tara' | 'fotos'
const EXIGENCIAS: {
  id: Exigencia
  regra: 'exigirLacre' | 'exigirNota' | 'exigirTara' | 'exigirFotosGerais'
  falta: (v: RecebimentoForm) => boolean
}[] = [
  { id: 'lacre', regra: 'exigirLacre', falta: (v) => !v.lacres.length },
  { id: 'nota', regra: 'exigirNota', falta: (v) => !v.notas.length },
  { id: 'tara', regra: 'exigirTara', falta: (v) => v.pallets.some((p) => p.tara === null) },
  {
    id: 'fotos',
    regra: 'exigirFotosGerais',
    falta: (v) => !v.fotosGerais.manter.length && !v.fotosGerais.novas.length,
  },
]

/** Lotes agendados para o combobox (até 20 por busca, pela data de coleta). */
async function buscarAgendados(busca: string) {
  const page = await listarOrdens({
    ...EMPTY_QUERY,
    search: busca,
    filters: [{ id: 'status', kind: 'in', values: ['agendado'] }],
    sort: [{ id: 'coletaPrevista', desc: false }],
    pageSize: 20,
  })
  return page.rows.map((o) => ({
    value: o.id,
    label: `${o.codigo} · ${o.clienteNome} · ${formatDate(o.dataColeta ?? o.coletaPrevista)}`,
  }))
}

export function RecebimentoSheet({
  loteId,
  permissao,
  onClose,
}: {
  /** null = escolher o lote no painel. */
  loteId: string | null
  permissao: string
  onClose: () => void
}) {
  const lote = useQuery({
    queryKey: ordensKeys.detalhe(loteId ?? ''),
    queryFn: ({ signal }) => obterOrdem(loteId!, signal),
    enabled: Boolean(loteId),
  })
  if (loteId && lote.isPending) return <CadastroSheetCarregando onClose={onClose} />
  return (
    <Formulario
      key={lote.data?.id ?? 'novo'}
      lote={lote.data}
      permissao={permissao}
      onClose={onClose}
    />
  )
}

function CadastroSheetCarregando({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={t('recebimento.receberTitulo')}
      descricao={t('recebimento.descricao')}
      formId="form-recebimento"
      salvando={false}
      sujo={false}
      permissao="operacao.recebimento.editar"
      dados={<Skeleton className="h-64 w-full" />}
    />
  )
}

function Formulario({
  lote,
  permissao,
  onClose,
}: {
  lote: Ordem | undefined
  permissao: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const corrigir = Boolean(lote?.recebimento)
  // Só se recebe lote agendado; só se corrige recebimento de lote em Inspeção.
  const bloqueado =
    lote && (corrigir ? lote.status !== 'inspecao' && !lote.devolucao : lote.status !== 'agendado')
  const salvar = useSalvarRecebimento()
  const traducao = useTraducao()
  // Lista de lotes atualizada a cada abertura do painel (o recebido sai da lista).
  const [chaveLotes] = useState(() => `recebimento-lotes-${Date.now()}`)
  const [rotuloLote, setRotuloLote] = useState('')
  const form = useForm<RecebimentoForm>({
    resolver: zodResolver(recebimentoSchema),
    mode: 'onTouched',
    defaultValues: lote && corrigir ? recebimentoParaForm(lote) : novoRecebimento(lote),
  })
  const [loteId, clienteNome, descricao] = useWatch({
    control: form.control,
    name: ['loteId', 'clienteNome', 'descricao'],
  })
  const inspecao = useWatch({ control: form.control, name: 'inspecao' })
  const idioma = useIdiomaTexto(descricao ?? '', lote?.recebimento?.inspecaoDescricao?.origem)
  const urlFoto = (id: string) => (f: { id: string }) => urlFotoRecebimento(id, f.id)
  // Aba Configurações do cliente do lote: o que ele exige no recebimento e as instruções.
  const escolhido = useQuery({
    queryKey: ordensKeys.detalhe(loteId),
    queryFn: ({ signal }) => obterOrdem(loteId, signal),
    enabled: !lote && Boolean(loteId),
  })
  const regras = useCliente(lote?.clienteId ?? escolhido.data?.clienteId).data?.configuracoes
  const exigidos = EXIGENCIAS.filter((e) => regras?.[e.regra])
  const [faltando, setFaltando] = useState<Exigencia[]>([])
  // Recebimento novo pronto para gravar, esperando a impressão das etiquetas.
  const [etiquetas, setEtiquetas] = useState<{ pedido: Pedido; lista: EtiquetaPallet[] } | null>(
    null,
  )

  const enviar = form.handleSubmit(async (v) => {
    const falta = exigidos.filter((e) => e.falta(v))
    setFaltando(falta.map((e) => e.id))
    if (regras?.exigirTara)
      v.pallets.forEach((p, i) => {
        if (p.tara === null) form.setError(`pallets.${i}.tara`, { message: 'validation.required' })
      })
    if (falta.length) return
    const anterior = lote?.recebimento?.inspecaoDescricao ?? null
    const original = v.descricao.trim()
    let texto = null
    if (v.inspecao !== 'bom')
      texto =
        anterior && textoOriginal(anterior).trim() === original && idioma.idioma === anterior.origem
          ? anterior
          : await traducao.traduzir(original, idioma.idioma)
    const { dados, fotos } = formParaEnvio(v, texto)
    const pedido = { v, ordemId: v.loteId, dados, fotos }
    // Recebimento novo: só conclui depois de imprimir uma etiqueta por pallet (27/10/2026).
    if (corrigir) await gravar(pedido)
    else {
      const doLote = lote ?? escolhido.data
      setEtiquetas({
        pedido,
        lista: etiquetasDosPallets({
          cliente: doLote?.clienteNome ?? v.clienteNome,
          lote: doLote?.codigo ?? rotuloLote.split(' · ')[0] ?? '',
          data: dados.dataRecebimento,
          pallets: dados.pallets.map((p) => ({ bruto: p.pesoBruto, tara: p.tara })),
        }),
      })
    }
  })

  async function gravar(p: Pedido) {
    const salvo = await salvar
      .mutateAsync({
        ordemId: p.ordemId,
        dados: p.dados,
        fotos: p.fotos,
        modo: corrigir ? 'corrigir' : 'receber',
      })
      .catch(() => null)
    if (salvo) {
      form.reset(p.v)
      onClose()
    }
  }

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={
        corrigir
          ? t('recebimento.corrigirTitulo', { code: lote!.codigo })
          : t('recebimento.receberTitulo')
      }
      descricao={corrigir ? t('recebimento.corrigirDescricao') : t('recebimento.descricao')}
      status={lote ? <StatusDoLote lote={lote} /> : undefined}
      formId="form-recebimento"
      salvando={form.formState.isSubmitting || salvar.isPending}
      sujo={form.formState.isDirty}
      permissao={permissao}
      dados={
        <form
          id="form-recebimento"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (!bloqueado) void enviar()
          }}
        >
          {bloqueado && (
            <Alert tone="warning" title={t('recebimento.bloqueadoTitle')}>
              {corrigir ? t('recebimento.bloqueadoCorrigir') : t('recebimento.bloqueadoReceber')}
            </Alert>
          )}

          <CadastroSecao titulo={t('recebimento.secoes.lote')}>
            <RhfField
              control={form.control}
              name="loteId"
              label={t('recebimento.campos.lote')}
              required
            >
              {({ field, control }) =>
                lote ? (
                  <Input {...control} value={lote.codigo} readOnly className="font-mono" />
                ) : (
                  <AsyncCombobox
                    {...control}
                    queryKey={chaveLotes}
                    loadOptions={buscarAgendados}
                    placeholder={t('recebimento.escolhaLote')}
                    value={field.value ? { value: field.value, label: rotuloLote } : null}
                    onValueChange={(o) => {
                      field.onChange(o?.value ?? '')
                      setRotuloLote(o?.label ?? '')
                      // "LOT-00001 · Cliente · data" → o cliente vem do lote.
                      form.setValue('clienteNome', o?.label.split(' · ')[1] ?? '')
                      field.onBlur()
                    }}
                  />
                )
              }
            </RhfField>
            <RhfField
              control={form.control}
              name="clienteNome"
              label={t('recebimento.campos.cliente')}
            >
              {({ control }) => (
                <Input
                  {...control}
                  value={clienteNome || ''}
                  placeholder={t('recebimento.clienteDoLote')}
                  readOnly
                />
              )}
            </RhfField>
            {!lote && loteId && (
              <p className="type-caption text-muted-foreground sm:col-span-2">
                {t('recebimento.loteEscolhido')}
              </p>
            )}
            {!corrigir && loteId && <CodigoDeChegada ordemId={loteId} />}
            {regras?.instrucoes && (
              <Alert
                tone="info"
                title={t('ordens.agendamento.cliente.instrucoes')}
                className="sm:col-span-2"
              >
                <TextoTraduzido valor={regras.instrucoes} className="whitespace-pre-line" />
              </Alert>
            )}
            {exigidos.length > 0 && (
              <Alert
                tone={faltando.length ? 'danger' : 'info'}
                title={t('recebimento.exige.titulo')}
                className="sm:col-span-2"
              >
                <ul className="list-inside list-disc">
                  {exigidos.map((e) => (
                    <li key={e.id} className={faltando.includes(e.id) ? 'font-medium' : undefined}>
                      {t(`recebimento.exige.${e.id}`)}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </CadastroSecao>

          <CadastroSecao titulo={t('recebimento.secoes.chegada')}>
            <RhfField
              control={form.control}
              name="dataRecebimento"
              label={t('recebimento.campos.dataRecebimento')}
              required
            >
              {({ field, control }) => (
                <DatePicker {...control} value={field.value} onValueChange={field.onChange} />
              )}
            </RhfField>
            <span aria-hidden className="hidden sm:block" />
            <RhfField
              control={form.control}
              name="inspecao"
              label={t('recebimento.campos.inspecao')}
              help={t('recebimento.inspecaoAjuda')}
              required
              className="sm:col-span-2"
            >
              {({ field, control }) => (
                <RadioGroup
                  {...control}
                  value={field.value ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v as InspecaoVisual)
                    field.onBlur()
                    if (form.formState.isSubmitted) void form.trigger('descricao')
                  }}
                  className="flex flex-wrap gap-3"
                >
                  {INSPECOES.map((i) => (
                    <label
                      key={i}
                      className="min-h-control flex cursor-pointer items-center gap-2 rounded-md border px-3 type-body has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-selected"
                    >
                      <RadioGroupItem value={i} />
                      {t(`status.inspecao_${i}`)}
                    </label>
                  ))}
                </RadioGroup>
              )}
            </RhfField>
            {inspecao && inspecao !== 'bom' && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <RhfField
                  control={form.control}
                  name="descricao"
                  label={t('recebimento.campos.descricao')}
                  help={t('recebimento.descricaoAjuda')}
                  maxLength={MAX_DESCRICAO}
                  required
                >
                  {({ field, control }) => <Textarea {...control} {...field} rows={3} />}
                </RhfField>
                <SeletorIdiomaTexto
                  texto={descricao ?? ''}
                  idioma={idioma.idioma}
                  detectado={idioma.detectado}
                  onChange={idioma.definir}
                />
              </div>
            )}
          </CadastroSecao>

          <Itens form={form} nome="lacres" loteId={loteId} urlFoto={urlFoto} />
          <Itens form={form} nome="notas" loteId={loteId} urlFoto={urlFoto} />
          <Pallets form={form} loteId={loteId} urlFoto={urlFoto} />

          <CadastroSecao
            titulo={t('recebimento.secoes.fotosGerais')}
            descricao={t('recebimento.fotosGeraisAjuda')}
            colunas={1}
          >
            <RhfField
              control={form.control}
              name="fotosGerais"
              label={t('recebimento.campos.fotos')}
            >
              {({ field, control }) => (
                <CampoFotos
                  id={control.id}
                  describedBy={control['aria-describedby']}
                  rotulo={t('recebimento.secoes.fotosGerais')}
                  valor={field.value}
                  onChange={field.onChange}
                  urlDe={urlFoto(loteId)}
                  max={MAX_FOTOS_GERAIS}
                />
              )}
            </RhfField>
          </CadastroSecao>
          {etiquetas && (
            <EtiquetasDoRecebimento
              loteId={etiquetas.pedido.ordemId}
              etiquetas={etiquetas.lista}
              salvando={salvar.isPending}
              onVoltar={() => setEtiquetas(null)}
              onConcluir={() => void gravar(etiquetas.pedido)}
            />
          )}
        </form>
      }
    />
  )
}

/* ------------------------------------------------------------ lacres e notas fiscais */

function Itens({
  form,
  nome,
  loteId,
  urlFoto,
}: {
  form: Form
  nome: 'lacres' | 'notas'
  loteId: string
  urlFoto: (id: string) => (f: { id: string }) => string
}) {
  const { t } = useTranslation()
  const lista = useFieldArray({ control: form.control, name: nome, keyName: 'chave' })
  const singular = nome === 'lacres' ? 'lacre' : 'nota'
  return (
    <CadastroSecao
      titulo={t(`recebimento.secoes.${nome}`)}
      descricao={t(`recebimento.${nome}Ajuda`)}
      colunas={1}
    >
      {lista.fields.map((f, i) => {
        const rotulo = t(`recebimento.${singular}N`, { n: i + 1 })
        return (
          <fieldset key={f.chave} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <legend className="type-card-title">{rotulo}</legend>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('recebimento.remover', { item: rotulo })}
                onClick={() => lista.remove(i)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            <RhfField
              control={form.control}
              name={`${nome}.${i}.numero`}
              label={t(`recebimento.campos.numero_${singular}`)}
              maxLength={40}
              required
            >
              {({ field, control }) => (
                <Input {...control} {...field} autoComplete="off" className="font-mono" />
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name={`${nome}.${i}.fotos`}
              label={t(`recebimento.campos.foto_${singular}`)}
              required
            >
              {({ field, fieldState, control }) => (
                <CampoFotos
                  id={control.id}
                  describedBy={control['aria-describedby']}
                  rotulo={rotulo}
                  valor={field.value}
                  onChange={(v) => {
                    field.onChange(v)
                    field.onBlur()
                  }}
                  urlDe={urlFoto(loteId)}
                  max={MAX_FOTOS_ITEM}
                  invalido={Boolean(fieldState.error)}
                />
              )}
            </RhfField>
          </fieldset>
        )
      })}
      <Button type="button" variant="outline" onClick={() => lista.append(novoLacre())}>
        <Plus aria-hidden />
        {t(`recebimento.adicionar_${singular}`)}
      </Button>
    </CadastroSecao>
  )
}

/* ------------------------------------------------------------ pallets */

function Pallets({
  form,
  loteId,
  urlFoto,
}: {
  form: Form
  loteId: string
  urlFoto: (id: string) => (f: { id: string }) => string
}) {
  const { t } = useTranslation()
  const lista = useFieldArray({ control: form.control, name: 'pallets', keyName: 'chave' })
  const pallets = useWatch({ control: form.control, name: 'pallets' }) ?? []
  const erroLista =
    form.formState.errors.pallets?.root?.message ?? form.formState.errors.pallets?.message
  const liquido = (i: number) => {
    const p = pallets[i]
    if (!p?.pesoBruto) return EMPTY
    return `${formatNumber(p.pesoBruto - (p.tara ?? 0))} kg`
  }
  const peso = (
    name: `pallets.${number}.pesoBruto` | `pallets.${number}.tara`,
    label: string,
    required?: boolean,
  ) => (
    <RhfField control={form.control} name={name} label={label} required={required}>
      {({ field, control }) => (
        <NumberInput
          {...control}
          value={field.value ?? null}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          scale={2}
          min={0}
          suffix="kg"
        />
      )}
    </RhfField>
  )

  return (
    <CadastroSecao
      titulo={t('recebimento.secoes.pallets')}
      descricao={t('recebimento.palletsAjuda')}
      colunas={1}
    >
      {erroLista && <Alert tone="danger" title={t(erroLista as 'validation.palletRequired')} />}
      {lista.fields.map((f, i) => {
        const rotulo = t('recebimento.palletN', { n: i + 1 })
        return (
          <fieldset key={f.chave} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <legend className="type-card-title">{rotulo}</legend>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('recebimento.remover', { item: rotulo })}
                onClick={() => lista.remove(i)}
                disabled={lista.fields.length === 1}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {peso(`pallets.${i}.pesoBruto`, t('recebimento.campos.pesoBruto'), true)}
              {peso(`pallets.${i}.tara`, t('recebimento.campos.tara'))}
              <div className="flex flex-col gap-1.5">
                <span className="type-label">{t('recebimento.campos.pesoLiquido')}</span>
                <output
                  className="flex h-control items-center rounded-md border border-dashed bg-muted px-3 type-body num"
                  aria-label={`${t('recebimento.campos.pesoLiquido')} — ${rotulo}`}
                >
                  {liquido(i)}
                </output>
              </div>
            </div>
            <RhfField
              control={form.control}
              name={`pallets.${i}.conteudo`}
              label={t('recebimento.campos.conteudo')}
              maxLength={200}
            >
              {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
            </RhfField>
            <RhfField
              control={form.control}
              name={`pallets.${i}.fotos`}
              label={t('recebimento.campos.fotoPallet')}
              required
            >
              {({ field, fieldState, control }) => (
                <CampoFotos
                  id={control.id}
                  describedBy={control['aria-describedby']}
                  rotulo={rotulo}
                  valor={field.value}
                  onChange={(v) => {
                    field.onChange(v)
                    field.onBlur()
                  }}
                  urlDe={urlFoto(loteId)}
                  max={MAX_FOTOS_ITEM}
                  invalido={Boolean(fieldState.error)}
                />
              )}
            </RhfField>
          </fieldset>
        )
      })}
      <Button type="button" variant="outline" onClick={() => lista.append(novoPallet())}>
        <Plus aria-hidden />
        {t('recebimento.adicionarPallet')}
      </Button>
    </CadastroSecao>
  )
}
