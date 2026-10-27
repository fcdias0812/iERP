import { useId, useState } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField } from '@/components/ui/form-field'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RodapeTraduzivel } from '@/features/cadastros/CampoTraduzivel'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { useCriarTipoDocumento, useNomeDoTipo } from '@/features/lotes/tipos-documento'
import { useOpcoesTransportadoras } from '@/features/motoristas/use-motoristas'
import { NENHUM, SERVICOS } from '@/features/ordens/agendamento-schema'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { textoOriginal, type LocalizedText } from '@/lib/localized-text'
import { z } from '@/lib/zod-i18n'
import type { Cliente, ServicosOs } from '@/services/types'
import { NOME_SISTEMA, SISTEMAS_PROCESSAMENTO } from '../configuracoes'
import { useSalvarConfiguracoes } from '../use-clientes'

/*
 * Painel da aba Configurações do cliente (padrão de edição do iERP: painel lateral). Cinco
 * seções — Rastreio da coleta, Agendamento, Recebimento, Documentos do lote, Prazos e
 * processamento — com as opções que ele escolheu em 22/10/2026. Instruções do cliente e nome de
 * tipo de documento novo em 3 idiomas (texto operacional).
 */

const MAX_INSTRUCOES = 2000
const MAX_MOTIVO = 500
const MAX_TIPO = 60

const SERVICOS_DO_SISTEMA: ServicosOs = {
  psm: false,
  onsiteShredding: false,
  recycleOnly: true,
  valueRecoveryRacks: true,
  valueRecoveryItad: false,
}

const dias = (max: number) => z.number().int().min(1).max(max).nullable()

const schema = z
  .object({
    rastrearColeta: z.boolean(),
    rastreioExcecao: z.boolean(),
    exigirMotoristaPlaca: z.boolean(),
    usarServicosPadrao: z.boolean(),
    servicos: z.object({
      psm: z.boolean(),
      onsiteShredding: z.boolean(),
      recycleOnly: z.boolean(),
      valueRecoveryRacks: z.boolean(),
      valueRecoveryItad: z.boolean(),
    }),
    transportadoraPadraoId: z.string(),
    instrucoes: z.string().trim().max(MAX_INSTRUCOES),
    exigirEscopoPlanilha: z.boolean(),
    exigirLacre: z.boolean(),
    exigirNota: z.boolean(),
    exigirTara: z.boolean(),
    exigirFotosGerais: z.boolean(),
    sistemaProcessamento: z.string(),
    slaDias: dias(3650),
    diasParadoEtapa: dias(365),
    antecedenciaDias: dias(365),
    agendamentoBloqueado: z.boolean(),
    bloqueioMotivo: z.string().trim().max(MAX_MOTIVO),
    documentos: z.array(
      z.object({ tipo: z.string(), aceita: z.boolean(), relatorio: z.boolean() }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.agendamentoBloqueado && !v.bloqueioMotivo)
      ctx.addIssue({ code: 'custom', path: ['bloqueioMotivo'], message: 'validation.required' })
  })
type Form = z.input<typeof schema>

type CampoSimNao = Extract<
  FieldPath<Form>,
  | 'rastrearColeta'
  | 'rastreioExcecao'
  | 'exigirMotoristaPlaca'
  | 'usarServicosPadrao'
  | 'exigirEscopoPlanilha'
  | 'exigirLacre'
  | 'exigirNota'
  | 'exigirTara'
  | 'exigirFotosGerais'
  | 'agendamentoBloqueado'
>

export function ConfiguracoesSheet({ c, onClose }: { c: Cliente; onClose: () => void }) {
  const { t } = useTranslation()
  const cfg = c.configuracoes
  const salvar = useSalvarConfiguracoes(c.id)
  const traducao = useTraducao()
  const transportadoras = useOpcoesTransportadoras()
  const [traduzido, setTraduzido] = useState<LocalizedText | null>(cfg.instrucoes)
  const grupoServicos = useId()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      rastrearColeta: cfg.rastrearColeta,
      rastreioExcecao: cfg.rastreioExcecao,
      exigirMotoristaPlaca: cfg.exigirMotoristaPlaca,
      usarServicosPadrao: Boolean(cfg.servicosPadrao),
      servicos: cfg.servicosPadrao ?? SERVICOS_DO_SISTEMA,
      transportadoraPadraoId: cfg.transportadoraPadraoId ?? NENHUM,
      instrucoes: cfg.instrucoes ? textoOriginal(cfg.instrucoes) : '',
      exigirEscopoPlanilha: cfg.exigirEscopoPlanilha,
      exigirLacre: cfg.exigirLacre,
      exigirNota: cfg.exigirNota,
      exigirTara: cfg.exigirTara,
      exigirFotosGerais: cfg.exigirFotosGerais,
      sistemaProcessamento: cfg.sistemaProcessamento ?? NENHUM,
      slaDias: cfg.slaDias,
      diasParadoEtapa: cfg.diasParadoEtapa,
      antecedenciaDias: cfg.antecedenciaDias,
      agendamentoBloqueado: cfg.agendamentoBloqueado,
      bloqueioMotivo: cfg.bloqueioMotivo ?? '',
      documentos: cfg.documentos.map((d) => ({
        tipo: d.codigo,
        aceita: d.aceita,
        relatorio: d.relatorio,
      })),
    },
  })
  const [usarServicos, bloqueado, sistema, instrucoes] = useWatch({
    control: form.control,
    name: ['usarServicosPadrao', 'agendamentoBloqueado', 'sistemaProcessamento', 'instrucoes'],
  })
  const idioma = useIdiomaTexto(instrucoes ?? '', cfg.instrucoes?.origem)
  const campo = (k: string) => t(`clientes.config.campos.${k as 'rastrearColeta'}`)
  const ajuda = (k: string) => t(`clientes.config.ajuda.${k as 'rastrearColeta'}`)

  const enviar = form.handleSubmit(async (v) => {
    const original = v.instrucoes.trim()
    let texto: LocalizedText | null = null
    if (original)
      texto =
        traduzido &&
        textoOriginal(traduzido).trim() === original &&
        idioma.idioma === traduzido.origem
          ? traduzido
          : await traducao.traduzir(original, idioma.idioma)
    const salvo = await salvar
      .mutateAsync({
        rastrearColeta: v.rastrearColeta,
        rastreioExcecao: v.rastreioExcecao,
        exigirMotoristaPlaca: v.exigirMotoristaPlaca,
        servicosPadrao: v.usarServicosPadrao ? v.servicos : null,
        transportadoraPadraoId:
          v.transportadoraPadraoId === NENHUM ? null : v.transportadoraPadraoId,
        instrucoes: texto,
        exigirEscopoPlanilha: v.exigirEscopoPlanilha,
        exigirLacre: v.exigirLacre,
        exigirNota: v.exigirNota,
        exigirTara: v.exigirTara,
        exigirFotosGerais: v.exigirFotosGerais,
        sistemaProcessamento: v.sistemaProcessamento === NENHUM ? null : v.sistemaProcessamento,
        slaDias: v.slaDias,
        diasParadoEtapa: v.diasParadoEtapa,
        antecedenciaDias: v.antecedenciaDias,
        agendamentoBloqueado: v.agendamentoBloqueado,
        bloqueioMotivo: v.agendamentoBloqueado ? v.bloqueioMotivo : null,
        documentos: v.documentos,
      })
      .catch(() => null)
    if (salvo) {
      form.reset(v)
      onClose()
    }
  })

  const simNao = (name: CampoSimNao, className?: string) => (
    <RhfField
      control={form.control}
      name={name}
      label={campo(name)}
      help={ajuda(name)}
      className={className}
    >
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

  const numeroDias = (name: 'slaDias' | 'diasParadoEtapa' | 'antecedenciaDias', max: number) => (
    <RhfField control={form.control} name={name} label={campo(name)} help={ajuda(name)}>
      {({ field, control }) => (
        <NumberInput
          {...control}
          value={field.value ?? null}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          scale={0}
          min={1}
          max={max}
          suffix={t('clientes.config.valores.diasSufixo')}
        />
      )}
    </RhfField>
  )

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={t('clientes.config.titulo')}
      descricao={t('clientes.config.descricao', { name: c.nome })}
      formId="form-configuracoes"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty || traduzido !== cfg.instrucoes}
      permissao="clientes.editar"
      dados={
        <form
          id="form-configuracoes"
          noValidate
          className="flex flex-col gap-8"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <CadastroSecao
            titulo={t('clientes.config.secoes.rastreio')}
            descricao={t('clientes.config.secoesAjuda.rastreio')}
          >
            {simNao('rastrearColeta')}
            {simNao('rastreioExcecao')}
            {simNao('exigirMotoristaPlaca')}
          </CadastroSecao>

          <CadastroSecao
            titulo={t('clientes.config.secoes.agendamento')}
            descricao={t('clientes.config.secoesAjuda.agendamento')}
          >
            {simNao('usarServicosPadrao', 'sm:col-span-full')}
            {usarServicos && (
              <div
                role="group"
                aria-labelledby={grupoServicos}
                className="flex flex-col gap-3 sm:col-span-full"
              >
                <span id={grupoServicos} className="sr-only">
                  {campo('servicosPadrao')}
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
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                        {t(`ordens.agendamento.servicos.${s}`)}
                      </label>
                    )}
                  />
                ))}
              </div>
            )}
            <RhfField
              control={form.control}
              name="transportadoraPadraoId"
              label={campo('transportadoraPadrao')}
              help={ajuda('transportadoraPadrao')}
            >
              {({ field, control }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>{t('clientes.config.valores.nenhuma')}</SelectItem>
                    {(transportadoras.data ?? [])
                      .filter((o) => o.status === 'ativo' || o.id === cfg.transportadoraPadraoId)
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            {simNao('exigirEscopoPlanilha')}
            <div className="flex flex-col gap-1.5 sm:col-span-full">
              <RhfField
                control={form.control}
                name="instrucoes"
                label={campo('instrucoes')}
                help={ajuda('instrucoes')}
                maxLength={MAX_INSTRUCOES}
              >
                {({ field, control }) => <Textarea {...control} {...field} rows={4} />}
              </RhfField>
              <RodapeTraduzivel
                rotulo={campo('instrucoes')}
                texto={instrucoes ?? ''}
                idioma={idioma.idioma}
                detectado={idioma.detectado}
                onIdioma={idioma.definir}
                traduzido={traduzido}
                multilinha
                maxLength={MAX_INSTRUCOES}
                onRevisar={(v) => {
                  setTraduzido(v)
                  form.setValue('instrucoes', textoOriginal(v), { shouldDirty: true })
                  idioma.definir(v.origem)
                }}
              />
            </div>
          </CadastroSecao>

          <CadastroSecao
            titulo={t('clientes.config.secoes.recebimento')}
            descricao={t('clientes.config.secoesAjuda.recebimento')}
          >
            {simNao('exigirLacre')}
            {simNao('exigirNota')}
            {simNao('exigirTara')}
            {simNao('exigirFotosGerais')}
          </CadastroSecao>

          <CadastroSecao
            titulo={t('clientes.config.secoes.documentos')}
            descricao={t('clientes.config.secoesAjuda.documentos')}
          >
            <DocumentosDoLote form={form} />
          </CadastroSecao>

          <CadastroSecao
            titulo={t('clientes.config.secoes.prazos')}
            descricao={t('clientes.config.secoesAjuda.prazos')}
          >
            <RhfField
              control={form.control}
              name="sistemaProcessamento"
              label={campo('sistemaProcessamento')}
              help={ajuda('sistemaProcessamento')}
              className="sm:col-span-full"
            >
              {({ field, control }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>
                      {t('clientes.config.valores.processadoAqui')}
                    </SelectItem>
                    {SISTEMAS_PROCESSAMENTO.map((s) => (
                      <SelectItem key={s} value={s}>
                        {NOME_SISTEMA[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            {sistema !== (cfg.sistemaProcessamento ?? NENHUM) && (
              <Alert
                tone="warning"
                title={t('clientes.config.avisoSistema')}
                className="sm:col-span-full"
              />
            )}
            {numeroDias('slaDias', 3650)}
            {numeroDias('diasParadoEtapa', 365)}
            {numeroDias('antecedenciaDias', 365)}
            {simNao('agendamentoBloqueado', 'col-start-1')}
            {bloqueado && (
              <RhfField
                control={form.control}
                name="bloqueioMotivo"
                label={campo('bloqueioMotivo')}
                help={ajuda('bloqueioMotivo')}
                maxLength={MAX_MOTIVO}
                required
                className="sm:col-span-full"
              >
                {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
              </RhfField>
            )}
          </CadastroSecao>
        </form>
      }
    />
  )
}

/**
 * Documentos do lote: por tipo, "Aceita" (aparece na aba Documentos do lote) e "Vai no relatório
 * final" (o ZIP só sai com ele no lote). Tipo que não está na lista? Cria aqui mesmo (3 idiomas).
 */
function DocumentosDoLote({ form }: { form: UseFormReturn<Form> }) {
  const { t } = useTranslation()
  const nomeDoTipo = useNomeDoTipo()
  const lista = useFieldArray({ control: form.control, name: 'documentos', keyName: 'chave' })
  const marcas = useWatch({ control: form.control, name: 'documentos' })
  const criar = useCriarTipoDocumento()
  const traducao = useTraducao()
  const [novo, setNovo] = useState('')
  const ocupado = criar.isPending || traducao.traduzindo

  const adicionar = async () => {
    const nome = novo.trim()
    if (!nome || ocupado) return
    const texto = await traducao.traduzir(nome)
    const tipo = await criar.mutateAsync(texto).catch(() => null)
    if (!tipo) return
    lista.append({ tipo: tipo.codigo, aceita: true, relatorio: false })
    setNovo('')
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-full">
      <ul className="divide-y rounded-md border">
        {lista.fields.map((f, i) => {
          const nome = nomeDoTipo(f.tipo)
          const aceita = marcas?.[i]?.aceita ?? f.aceita
          return (
            <li
              key={f.chave}
              className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="type-body sm:flex-1">{nome}</span>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Controller
                  control={form.control}
                  name={`documentos.${i}.aceita`}
                  render={({ field }) => (
                    <Interruptor
                      rotulo={t('clientes.config.documentos.aceita')}
                      tipo={nome}
                      checked={field.value}
                      // O escopo sempre (o agendamento usa).
                      disabled={f.tipo === 'escopo'}
                      onChange={(v) => {
                        field.onChange(v)
                        if (!v)
                          form.setValue(`documentos.${i}.relatorio`, false, { shouldDirty: true })
                      }}
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name={`documentos.${i}.relatorio`}
                  render={({ field }) => (
                    <Interruptor
                      rotulo={t('clientes.config.documentos.relatorio')}
                      tipo={nome}
                      checked={field.value}
                      disabled={!aceita}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <FormField
        label={t('clientes.config.documentos.novo')}
        help={t('clientes.config.documentos.novoAjuda')}
      >
        {(f) => (
          <div className="flex gap-2">
            <Input
              {...f}
              className="flex-1"
              value={novo}
              maxLength={MAX_TIPO}
              autoComplete="off"
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                void adicionar()
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!novo.trim() || ocupado}
              onClick={() => void adicionar()}
            >
              <Plus aria-hidden />
              {t('clientes.config.documentos.criar')}
            </Button>
          </div>
        )}
      </FormField>
    </div>
  )
}

function Interruptor({
  rotulo,
  tipo,
  checked,
  disabled,
  onChange,
}: {
  rotulo: string
  tipo: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex min-h-6 items-center gap-2">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <label htmlFor={id} className="type-body">
        {rotulo}
        <span className="sr-only"> — {tipo}</span>
      </label>
    </div>
  )
}
