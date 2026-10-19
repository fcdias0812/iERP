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
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan } from '@/hooks/use-can'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { formatNumber } from '@/lib/format'
import { textoEm, textoOriginal, type LocalizedText } from '@/lib/localized-text'
import { z } from '@/lib/zod-i18n'
import { ApiError } from '@/services/http'
import type { Material, MaterialDetalhe } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { RodapeTraduzivel } from './CampoTraduzivel'
import { PainelCarregando } from './comum'
import { useRotulosCadastro } from './rotulos'
import { materiaisHooks, useMateriais } from './use-cadastros'

/*
 * Cadastros › Materiais: os materiais que vão dentro dos caixotes e pallets. Nome nos 3 idiomas
 * (traduzido ao salvar; revisável). Lista inicial de 96 materiais (pedido do usuário).
 */

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }
const VAZIO: Material[] = []
const STATUS = ['ativo', 'inativo']
const CAMPOS = ['nome'] as const

export function AbaMateriais({
  aberto,
  onAbrir,
}: {
  aberto: string | undefined
  onAbrir: (id: string | undefined) => void
}) {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const lista = useMateriais()
  const podeCriar = useCan('cadastros.materiais.criar')
  const [query, setQuery] = useState<TableQuery>(ORDEM)

  const colunas = useMemo<DataTableColumn<Material>[]>(
    () => [
      {
        id: 'nome',
        header: t('cadastros.materiais.cols.nome'),
        type: 'unique-text',
        accessor: (r) => textoEm(r.nome, idioma),
        size: 420,
        mobile: 'title',
        cell: (r) => <TextoTraduzido valor={r.nome} compacto className="font-medium" />,
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
      {
        id: 'alteradoEm',
        header: t('cadastros.cols.alteradoEm'),
        type: 'date',
        accessor: (r) => r.alteradoEm,
        size: 150,
        hidden: true,
      },
    ],
    [t, idioma],
  )

  return (
    <>
      <DataTable
        id="cadastros-materiais"
        title={t('cadastros.abas.materiais')}
        exportName="materiais"
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
        createLabel={t('cadastros.materiais.novo')}
        empty={{ title: t('cadastros.materiais.vazio') }}
      />
      {aberto && (
        <MaterialPainel
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => onAbrir(undefined)}
        />
      )}
    </>
  )
}

function MaterialPainel({ id, onClose }: { id?: string; onClose: () => void }) {
  const detalhe = materiaisHooks.useDetalhe(id)
  if (id && detalhe.isPending) return <PainelCarregando />
  return (
    <MaterialFormulario
      material={detalhe.data}
      erro={Boolean(id) && detalhe.isError}
      onClose={onClose}
    />
  )
}

const schema = z.object({ nome: z.string().trim().min(1, 'validation.required').max(120) })
type Form = z.input<typeof schema>

function MaterialFormulario({
  material,
  erro,
  onClose,
}: {
  material?: MaterialDetalhe
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = materiaisHooks.useSalvar(material?.id)
  const transicao = materiaisHooks.useTransicao()
  const traducao = useTraducao()
  const rotulos = useRotulosCadastro(CAMPOS, 'cadastros.materiais.cols')
  const [traduzido, setTraduzido] = useState<LocalizedText | null>(material?.nome ?? null)
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { nome: material ? textoOriginal(material.nome) : '' },
  })
  const nome = useWatch({ control: form.control, name: 'nome' }) ?? ''
  const idioma = useIdiomaTexto(nome, material?.nome.origem)

  const enviar = form.handleSubmit(async (v) => {
    const original = v.nome.trim()
    const nomeFinal =
      traduzido &&
      textoOriginal(traduzido).trim() === original &&
      idioma.idioma === traduzido.origem
        ? traduzido
        : await traducao.traduzir(original, idioma.idioma)
    const salvo = await salvar.mutateAsync({ nome: nomeFinal }).catch((e: unknown) => {
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
      titulo={material ? textoOriginal(material.nome) : t('cadastros.materiais.novo')}
      descricao={t('cadastros.materiais.descricao')}
      status={material ? <StatusBadge status={material.status} /> : undefined}
      formId="form-material"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty || traduzido !== (material?.nome ?? null)}
      permissao={material ? 'cadastros.materiais.editar' : 'cadastros.materiais.criar'}
      acoes={material?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: material!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`cadastros.confirm.${acao}.title`, { name: textoOriginal(material!.nome) }),
        corpo: t('cadastros.materiais.confirm'),
        botao: t(`cadastros.acoes.${acao}`),
      })}
      historico={
        material ? (
          <HistoricoTabela
            id="material-historico"
            titulo={t('cadastro.abas.historico')}
            historico={material.historico}
            exportName={`historico-material`}
            acoes={rotulos.acoes}
            campos={rotulos.campos}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-material"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          {material?.status === 'inativo' && (
            <Alert tone="inactive" title={t('cadastros.inativoTitle')}>
              {t('cadastros.materiais.inativoBody')}
            </Alert>
          )}
          <CadastroSecao titulo={t('cadastros.materiais.secao')} colunas={1}>
            <div className="flex flex-col gap-1.5">
              <RhfField
                control={form.control}
                name="nome"
                label={t('cadastros.materiais.cols.nome')}
                help={t('cadastros.ajudaTraducao')}
                maxLength={120}
                required
              >
                {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
              </RhfField>
              <RodapeTraduzivel
                rotulo={t('cadastros.materiais.cols.nome')}
                texto={nome}
                idioma={idioma.idioma}
                detectado={idioma.detectado}
                onIdioma={idioma.definir}
                traduzido={traduzido}
                maxLength={120}
                onRevisar={(v) => {
                  setTraduzido(v)
                  form.setValue('nome', textoOriginal(v), { shouldDirty: true })
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
