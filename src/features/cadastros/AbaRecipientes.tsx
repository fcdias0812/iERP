import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Alert } from '@/components/ui/alert'
import { AsyncCombobox } from '@/components/ui/async-combobox'
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
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan } from '@/hooks/use-can'
import { formatNumber } from '@/lib/format'
import { textoEm } from '@/lib/localized-text'
import { z } from '@/lib/zod-i18n'
import type { Material, Recipiente, RecipienteDetalhe, TipoRecipiente } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { PainelCarregando } from './comum'
import { useRotulosCadastro } from './rotulos'
import { recipientesHooks, useAreas, useMateriais, useRecipientes } from './use-cadastros'

/*
 * Cadastros › Caixotes e Pallets (recipientes do estoque): material que vai dentro, tara (kg),
 * área do estoque e posição. Código automático por tipo e ano: CXT-20260001 / PLT-20260001
 * (decisão do usuário). Só materiais e áreas ATIVOS podem ser escolhidos.
 */

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'codigo', desc: true }] }
const VAZIO: Recipiente[] = []
const STATUS = ['ativo', 'inativo']
const CAMPOS = ['material', 'area', 'posicao', 'taraKg'] as const

/** Busca sem acento e sem diferenciar maiúsculas. */
const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function AbaRecipientes({
  tipo,
  aberto,
  onAbrir,
}: {
  tipo: TipoRecipiente
  aberto: string | undefined
  onAbrir: (id: string | undefined) => void
}) {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const lista = useRecipientes(tipo)
  const materiais = useMateriais()
  const areas = useAreas()
  const podeCriar = useCan('cadastros.criar')
  const [query, setQuery] = useState<TableQuery>(ORDEM)

  const colunas = useMemo<DataTableColumn<Recipiente>[]>(
    () => [
      {
        id: 'codigo',
        header: t('cadastros.recipientes.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 160,
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'material',
        header: t('cadastros.recipientes.cols.material'),
        type: 'enum',
        accessor: (r) => r.materialId,
        size: 300,
        cell: (r) => textoEm(r.materialNome, idioma),
        exportValue: (r) => textoEm(r.materialNome, idioma),
        options: (materiais.data ?? []).map((m) => ({
          value: m.id,
          label: textoEm(m.nome, idioma),
        })),
      },
      {
        id: 'area',
        header: t('cadastros.recipientes.cols.area'),
        type: 'enum',
        accessor: (r) => r.areaNome,
        size: 180,
        options: (areas.data ?? []).map((a) => ({ value: a.nome, label: a.nome })),
      },
      {
        id: 'posicao',
        header: t('cadastros.recipientes.cols.posicao'),
        type: 'unique-text',
        accessor: (r) => r.posicao,
        size: 130,
        cell: (r) => <span className="font-mono">{r.posicao}</span>,
      },
      {
        id: 'taraKg',
        header: t('cadastros.recipientes.cols.taraKg'),
        type: 'number',
        accessor: (r) => r.taraKg,
        size: 130,
        cell: (r) => <span className="num">{`${formatNumber(r.taraKg)} kg`}</span>,
      },
      {
        id: 'status',
        header: t('cadastros.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 130,
        mobile: 'badge',
        options: STATUS.map((s) => ({ value: s, label: s })),
      },
      {
        id: 'criadoEm',
        header: t('cadastros.recipientes.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 150,
      },
    ],
    [t, idioma, materiais.data, areas.data],
  )

  return (
    <>
      <DataTable
        id={`cadastros-${tipo}s`}
        title={t(`cadastros.abas.${tipo}s`)}
        exportName={`${tipo}s`}
        columns={colunas}
        getRowId={(r) => r.id}
        data={lista.data ?? VAZIO}
        query={query}
        onQueryChange={setQuery}
        loading={lista.isPending}
        error={lista.isError}
        onRetry={() => void lista.refetch()}
        onRowClick={(r) => onAbrir(r.id)}
        onCreate={podeCriar ? () => onAbrir('novo') : undefined}
        createLabel={t(`cadastros.recipientes.novo_${tipo}`)}
        empty={{
          title: t(`cadastros.recipientes.vazio_${tipo}`),
          description: t('cadastros.recipientes.vazioBody'),
        }}
      />
      {aberto && (
        <RecipientePainel
          key={aberto}
          tipo={tipo}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => onAbrir(undefined)}
        />
      )}
    </>
  )
}

function RecipientePainel({
  tipo,
  id,
  onClose,
}: {
  tipo: TipoRecipiente
  id?: string
  onClose: () => void
}) {
  const detalhe = recipientesHooks.useDetalhe(id)
  const materiais = useMateriais()
  const areas = useAreas()
  if ((id && detalhe.isPending) || materiais.isPending || areas.isPending)
    return <PainelCarregando />
  return (
    <RecipienteFormulario
      tipo={tipo}
      recipiente={detalhe.data}
      materiais={materiais.data ?? []}
      erro={Boolean(id) && detalhe.isError}
      onClose={onClose}
    />
  )
}

const schema = z.object({
  materialId: z.string().min(1, 'validation.required'),
  taraKg: z
    .number()
    .min(0)
    .max(10_000)
    .nullable()
    .refine((v) => v !== null, 'validation.required'),
  areaId: z.string().min(1, 'validation.required'),
  posicao: z.string().trim().min(1, 'validation.required').max(40),
})
type Form = z.input<typeof schema>

function RecipienteFormulario({
  tipo,
  recipiente,
  materiais,
  erro,
  onClose,
}: {
  tipo: TipoRecipiente
  recipiente?: RecipienteDetalhe
  materiais: Material[]
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const areas = useAreas()
  const salvar = recipientesHooks.useSalvar(recipiente?.id)
  const transicao = recipientesHooks.useTransicao()
  const rotulos = useRotulosCadastro(CAMPOS, 'cadastros.recipientes.cols')
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      materialId: recipiente?.materialId ?? '',
      taraKg: recipiente?.taraKg ?? null,
      areaId: recipiente?.areaId ?? '',
      posicao: recipiente?.posicao ?? '',
    },
  })
  // Só os ativos; o atual continua aparecendo mesmo se tiver sido inativado depois.
  const materialAtual = recipiente?.materialId
  const opcoesMaterial = useMemo(
    () =>
      materiais
        .filter((m) => m.status === 'ativo' || m.id === materialAtual)
        .map((m) => ({ value: m.id, label: textoEm(m.nome, idioma) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [materiais, materialAtual, idioma],
  )
  const opcoesArea = (areas.data ?? []).filter(
    (a) => a.status === 'ativo' || a.id === recipiente?.areaId,
  )
  const buscarMaterial = async (busca: string) => {
    const b = semAcento(busca)
    return opcoesMaterial.filter((o) => semAcento(o.label).includes(b)).slice(0, 50)
  }

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar
      .mutateAsync({
        tipo,
        materialId: v.materialId,
        taraKg: v.taraKg!,
        areaId: v.areaId,
        posicao: v.posicao.trim(),
      })
      .catch(() => null)
    if (salvo) {
      form.reset(v)
      onClose()
    }
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={recipiente ? recipiente.codigo : t(`cadastros.recipientes.novo_${tipo}`)}
      descricao={t(`cadastros.recipientes.descricao_${tipo}`)}
      status={recipiente ? <StatusBadge status={recipiente.status} /> : undefined}
      formId="form-recipiente"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={recipiente ? 'cadastros.editar' : 'cadastros.criar'}
      acoes={recipiente?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: recipiente!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`cadastros.confirm.${acao}.title`, { name: recipiente!.codigo }),
        corpo: t('cadastros.recipientes.confirm'),
        botao: t(`cadastros.acoes.${acao}`),
      })}
      historico={
        recipiente ? (
          <HistoricoTabela
            id="recipiente-historico"
            titulo={t('cadastro.abas.historico')}
            historico={recipiente.historico}
            exportName={`historico-${recipiente.codigo}`}
            acoes={rotulos.acoes}
            campos={rotulos.campos}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-recipiente"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          {recipiente?.status === 'inativo' && (
            <Alert tone="inactive" title={t('cadastros.inativoTitle')}>
              {t('cadastros.recipientes.inativoBody')}
            </Alert>
          )}
          {!recipiente && (
            <p className="type-caption text-muted-foreground">
              {t(`cadastros.recipientes.codigoAjuda_${tipo}`)}
            </p>
          )}
          <CadastroSecao titulo={t('cadastros.recipientes.secoes.conteudo')}>
            <RhfField
              control={form.control}
              name="materialId"
              label={t('cadastros.recipientes.cols.material')}
              required
              className="sm:col-span-2"
            >
              {({ field, control }) => (
                <AsyncCombobox
                  {...control}
                  queryKey={`cadastros-materiais-${opcoesMaterial.length}`}
                  loadOptions={buscarMaterial}
                  placeholder={t('cadastros.recipientes.escolhaMaterial')}
                  value={opcoesMaterial.find((o) => o.value === field.value) ?? null}
                  onValueChange={(o) => {
                    field.onChange(o?.value ?? '')
                    field.onBlur()
                  }}
                />
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name="taraKg"
              label={t('cadastros.recipientes.cols.taraKg')}
              help={t('cadastros.recipientes.taraAjuda')}
              required
            >
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
          </CadastroSecao>
          <CadastroSecao titulo={t('cadastros.recipientes.secoes.local')}>
            <RhfField
              control={form.control}
              name="areaId"
              label={t('cadastros.recipientes.cols.area')}
              help={opcoesArea.length ? undefined : t('cadastros.recipientes.semAreas')}
              required
            >
              {({ field, control }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!opcoesArea.length}
                >
                  <SelectTrigger {...control} onBlur={field.onBlur}>
                    <SelectValue placeholder={t('field.selectOne')} />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesArea.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name="posicao"
              label={t('cadastros.recipientes.cols.posicao')}
              help={t('cadastros.recipientes.posicaoAjuda')}
              maxLength={40}
              required
            >
              {({ field, control }) => (
                <Input {...control} {...field} autoComplete="off" className="font-mono" />
              )}
            </RhfField>
          </CadastroSecao>
        </form>
      }
    />
  )
}
