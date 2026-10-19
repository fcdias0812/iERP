import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Alert } from '@/components/ui/alert'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { TextoTraduzido } from '@/components/ui/localized-text'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan } from '@/hooks/use-can'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { formatNumber } from '@/lib/format'
import { textoEm, textoOriginal, type LocalizedText } from '@/lib/localized-text'
import { z } from '@/lib/zod-i18n'
import { ApiError } from '@/services/http'
import type { AreaEstoque, AreaEstoqueDetalhe } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { RodapeTraduzivel } from './CampoTraduzivel'
import { PainelCarregando } from './comum'
import { useRotulosCadastro } from './rotulos'
import { areasHooks, useAreas } from './use-cadastros'

/*
 * Cadastros › Áreas do estoque: onde os caixotes e pallets ficam. Nome (como foi escrito) e
 * descrição opcional nos 3 idiomas (decisão do usuário).
 */

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }
const VAZIO: AreaEstoque[] = []
const STATUS = ['ativo', 'inativo']
const CAMPOS = ['nome', 'descricao'] as const
const MAX_DESCRICAO = 500

export function AbaAreas({
  aberto,
  onAbrir,
}: {
  aberto: string | undefined
  onAbrir: (id: string | undefined) => void
}) {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const lista = useAreas()
  const podeCriar = useCan('cadastros.areas.criar')
  const [query, setQuery] = useState<TableQuery>(ORDEM)

  const colunas = useMemo<DataTableColumn<AreaEstoque>[]>(
    () => [
      {
        id: 'nome',
        header: t('cadastros.areas.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 220,
        mobile: 'title',
        cell: (r) => <span className="font-medium">{r.nome}</span>,
      },
      {
        id: 'descricao',
        header: t('cadastros.areas.cols.descricao'),
        type: 'unique-text',
        accessor: (r) => (r.descricao ? textoEm(r.descricao, idioma) : null),
        size: 380,
        sortable: false,
        cell: (r) => (r.descricao ? <TextoTraduzido valor={r.descricao} compacto /> : '—'),
      },
      {
        id: 'recipientes',
        header: t('cadastros.cols.recipientes'),
        type: 'number',
        accessor: (r) => r.recipientes,
        size: 150,
        cell: (r) => <span className="num">{formatNumber(r.recipientes)}</span>,
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
    ],
    [t, idioma],
  )

  return (
    <>
      <DataTable
        id="cadastros-areas"
        title={t('cadastros.abas.areas')}
        exportName="areas-estoque"
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
        createLabel={t('cadastros.areas.novo')}
        empty={{ title: t('cadastros.areas.vazio'), description: t('cadastros.areas.vazioBody') }}
      />
      {aberto && (
        <AreaPainel
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => onAbrir(undefined)}
        />
      )}
    </>
  )
}

function AreaPainel({ id, onClose }: { id?: string; onClose: () => void }) {
  const detalhe = areasHooks.useDetalhe(id)
  if (id && detalhe.isPending) return <PainelCarregando />
  return (
    <AreaFormulario area={detalhe.data} erro={Boolean(id) && detalhe.isError} onClose={onClose} />
  )
}

const schema = z.object({
  nome: z.string().trim().min(1, 'validation.required').max(60),
  descricao: z.string().trim().max(MAX_DESCRICAO),
})
type Form = z.input<typeof schema>

function AreaFormulario({
  area,
  erro,
  onClose,
}: {
  area?: AreaEstoqueDetalhe
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = areasHooks.useSalvar(area?.id)
  const transicao = areasHooks.useTransicao()
  const traducao = useTraducao()
  const rotulos = useRotulosCadastro(CAMPOS, 'cadastros.areas.cols')
  const [traduzido, setTraduzido] = useState<LocalizedText | null>(area?.descricao ?? null)
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      nome: area?.nome ?? '',
      descricao: area?.descricao ? textoOriginal(area.descricao) : '',
    },
  })
  const descricao = useWatch({ control: form.control, name: 'descricao' }) ?? ''
  const idioma = useIdiomaTexto(descricao, area?.descricao?.origem)

  const enviar = form.handleSubmit(async (v) => {
    const original = v.descricao.trim()
    let desc: LocalizedText | null = null
    if (original)
      desc =
        traduzido &&
        textoOriginal(traduzido).trim() === original &&
        idioma.idioma === traduzido.origem
          ? traduzido
          : await traducao.traduzir(original, idioma.idioma)
    const salvo = await salvar
      .mutateAsync({ nome: v.nome.trim(), descricao: desc })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === 'name_in_use')
          form.setError('nome', { message: 'validation.nameInUse' })
        return null
      })
    if (salvo) {
      form.reset(v)
      onClose()
    }
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={area ? area.nome : t('cadastros.areas.novo')}
      descricao={t('cadastros.areas.descricao')}
      status={area ? <StatusBadge status={area.status} /> : undefined}
      formId="form-area"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty || traduzido !== (area?.descricao ?? null)}
      permissao={area ? 'cadastros.areas.editar' : 'cadastros.areas.criar'}
      acoes={area?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: area!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`cadastros.confirm.${acao}.title`, { name: area!.nome }),
        corpo: t('cadastros.areas.confirm'),
        botao: t(`cadastros.acoes.${acao}`),
      })}
      historico={
        area ? (
          <HistoricoTabela
            id="area-historico"
            titulo={t('cadastro.abas.historico')}
            historico={area.historico}
            exportName={`historico-area-${area.nome}`}
            acoes={rotulos.acoes}
            campos={rotulos.campos}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-area"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          {area?.status === 'inativo' && (
            <Alert tone="inactive" title={t('cadastros.inativoTitle')}>
              {t('cadastros.areas.inativoBody')}
            </Alert>
          )}
          <CadastroSecao titulo={t('cadastros.areas.secao')} colunas={1}>
            <RhfField
              control={form.control}
              name="nome"
              label={t('cadastros.areas.cols.nome')}
              help={t('cadastros.areas.nomeAjuda')}
              maxLength={60}
              required
            >
              {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
            </RhfField>
            <div className="flex flex-col gap-1.5">
              <RhfField
                control={form.control}
                name="descricao"
                label={t('cadastros.areas.cols.descricao')}
                help={t('cadastros.ajudaTraducao')}
                maxLength={MAX_DESCRICAO}
              >
                {({ field, control }) => <Textarea {...control} {...field} rows={3} />}
              </RhfField>
              <RodapeTraduzivel
                rotulo={t('cadastros.areas.cols.descricao')}
                texto={descricao}
                idioma={idioma.idioma}
                detectado={idioma.detectado}
                onIdioma={idioma.definir}
                traduzido={traduzido}
                multilinha
                maxLength={MAX_DESCRICAO}
                onRevisar={(v) => {
                  setTraduzido(v)
                  form.setValue('descricao', textoOriginal(v), { shouldDirty: true })
                  idioma.definir(v.origem)
                }}
              />
            </div>
          </CadastroSecao>
        </form>
      }
    />
  )
}
