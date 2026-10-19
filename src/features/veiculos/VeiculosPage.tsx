import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import { DataTable, useUrlTableQuery, type DataTableColumn } from '@/components/data-table'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { RhfField } from '@/components/ui/form'
import { NumberInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan } from '@/hooks/use-can'
import { formatNumber } from '@/lib/format'
import type { Veiculo, VeiculoDetalhe } from '@/services/types'
import { listarTodosVeiculos } from '@/services/veiculos'
import { veiculosHooks } from './use-veiculos'
import {
  formParaInput,
  novoVeiculoForm,
  TIPOS_VEICULO,
  veiculoParaForm,
  veiculoSchema,
  type VeiculoForm,
} from './veiculo-schema'

/* Relacionamento › Veículos: lista + painel lateral (cadastro, edição e histórico). */

const STATUS = ['ativo', 'inativo']
const CAMPOS = [
  'tipo',
  'volumeMinimo',
  'volumeMaximo',
  'comprimento',
  'largura',
  'capacidadePallets',
  'capacidadeToneladas',
  'status',
] as const

/** Número com unidade (vazio = —). */
const medida = (v: number | null, unidade: string) =>
  v === null ? '—' : `${formatNumber(v, { maximumFractionDigits: 2 })} ${unidade}`

export function VeiculosPage() {
  return (
    <RequirePermission permission="veiculos.ver">
      <Veiculos />
    </RequirePermission>
  )
}

function Veiculos() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aberto } = useSearch({ from: '/_app/veiculos/' })
  const podeCriar = useCan('veiculos.criar')

  const colunas = useMemo<DataTableColumn<Veiculo>[]>(
    () => [
      {
        id: 'codigo',
        header: t('veiculos.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 130,
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'tipo',
        header: t('veiculos.cols.tipo'),
        type: 'enum',
        accessor: (r) => r.tipo,
        size: 160,
        options: TIPOS_VEICULO.map((x) => ({ value: x, label: t(`veiculos.tipos.${x}`) })),
      },
      ...(
        [
          ['volumeMinimo', 'm²', 150],
          ['volumeMaximo', 'm²', 150],
          ['comprimento', 'm', 140],
          ['largura', 'm', 120],
          ['capacidadePallets', '', 180],
          ['capacidadeToneladas', 't', 190],
        ] as const
      ).map(([id, unidade, size]): DataTableColumn<Veiculo> => ({
        id,
        header: t(`veiculos.cols.${id}`),
        type: 'number',
        accessor: (r) => r[id],
        size,
        cell: (r) => (
          <span className="num">{unidade ? medida(r[id], unidade) : (r[id] ?? '—')}</span>
        ),
      })),
      {
        id: 'status',
        header: t('veiculos.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 120,
        mobile: 'badge',
        options: STATUS.map((s) => ({ value: s, label: s })),
      },
      {
        id: 'criadoEm',
        header: t('veiculos.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 140,
        hidden: true,
      },
    ],
    [t],
  )
  const [query, setQuery] = useUrlTableQuery(colunas)
  const lista = veiculosHooks.useLista(query)
  const resumoQ = veiculosHooks.useResumo()

  const abrir = (id: string) =>
    void navigate({ to: '.', search: (s) => ({ ...s, aberto: id }), replace: false })
  const fechar = () => void navigate({ to: '.', search: (s) => ({ ...s, aberto: undefined }) })
  const kpi = (id: 'total' | 'ativos' | 'inativos') => ({
    id,
    label: t(`veiculos.kpis.${id}`),
    value: resumoQ.data ? formatNumber(resumoQ.data[id]) : '—',
    loading: resumoQ.isPending,
  })

  return (
    <ListPage
      title={t('nav.veiculos')}
      description={t('veiculos.list.description')}
      kpis={[kpi('total'), kpi('ativos'), kpi('inativos')]}
    >
      <DataTable
        id="veiculos"
        title={t('nav.veiculos')}
        exportName="veiculos"
        columns={colunas}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodosVeiculos(query)}
        onRowClick={(r) => abrir(r.id)}
        onCreate={podeCriar ? () => abrir('novo') : undefined}
        createLabel={t('veiculos.newTitle')}
        empty={{ title: t('veiculos.list.emptyTitle'), description: t('veiculos.list.emptyBody') }}
        rowActions={(r) => (
          <DropdownMenuItem onSelect={() => abrir(r.id)}>
            <Eye aria-hidden />
            {t('common.open')}
          </DropdownMenuItem>
        )}
      />
      {aberto && (
        <VeiculoPainel key={aberto} id={aberto === 'novo' ? undefined : aberto} onClose={fechar} />
      )}
    </ListPage>
  )
}

/** Painel do veículo: carrega o registro (edição) e mostra o formulário. */
function VeiculoPainel({ id, onClose }: { id?: string; onClose: () => void }) {
  const detalhe = veiculosHooks.useDetalhe(id)
  if (id && detalhe.isPending)
    return (
      <div className="sr-only" aria-busy>
        <Skeleton />
      </div>
    )
  return (
    <VeiculoFormulario
      veiculo={detalhe.data}
      erro={id ? detalhe.isError : false}
      onClose={onClose}
    />
  )
}

function VeiculoFormulario({
  veiculo,
  erro,
  onClose,
}: {
  veiculo?: VeiculoDetalhe
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = veiculosHooks.useSalvar(veiculo?.id)
  const transicao = veiculosHooks.useTransicao()
  const form = useForm<VeiculoForm>({
    resolver: zodResolver(veiculoSchema),
    mode: 'onTouched',
    defaultValues: veiculo ? veiculoParaForm(veiculo) : novoVeiculoForm(),
  })
  const acoes = useMemo(
    () => ({
      criado: t('historico.acoes.criado'),
      editado: t('historico.acoes.editado'),
      status: t('historico.acoes.status'),
    }),
    [t],
  )
  const campos = useMemo(
    () => Object.fromEntries(CAMPOS.map((k) => [k, t(`veiculos.cols.${k}`)])),
    [t],
  )
  const formatar = useMemo(
    () => (campo: string, v: unknown) =>
      campo === 'tipo' ? t(`veiculos.tipos.${v as 'van'}`) : undefined,
    [t],
  )

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar.mutateAsync(formParaInput(veiculoSchema.parse(v))).catch(() => null)
    if (salvo) {
      form.reset(veiculoParaForm(salvo))
      onClose()
    }
  })

  const numero = (name: Exclude<keyof VeiculoForm, 'tipo'>, sufixo: string, scale = 2) => (
    <RhfField control={form.control} name={name} label={t(`veiculos.cols.${name}`)}>
      {({ field, control }) => (
        <NumberInput
          {...control}
          value={field.value ?? null}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          scale={scale}
          min={0}
          suffix={sufixo}
        />
      )}
    </RhfField>
  )

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={veiculo ? t('veiculos.editTitle', { code: veiculo.codigo }) : t('veiculos.newTitle')}
      descricao={t('veiculos.formDescription')}
      status={veiculo ? <StatusBadge status={veiculo.status} /> : undefined}
      formId="form-veiculo"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={veiculo ? 'veiculos.editar' : 'veiculos.criar'}
      acoes={veiculo?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: veiculo!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`veiculos.confirm.${acao}.title`, { name: veiculo?.codigo ?? '' }),
        corpo: t(`veiculos.confirm.${acao}.body`),
        botao: t(`veiculos.acoes.${acao}`),
      })}
      historico={
        veiculo ? (
          <HistoricoTabela
            id="veiculo-historico"
            titulo={t('cadastro.abas.historico')}
            historico={veiculo.historico}
            exportName={`historico-${veiculo.codigo}`}
            acoes={acoes}
            campos={campos}
            formatar={formatar}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-veiculo"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          {veiculo?.status === 'inativo' && (
            <Alert tone="inactive" title={t('veiculos.inativoTitle')}>
              {t('veiculos.inativoBody')}
            </Alert>
          )}
          <CadastroSecao titulo={t('veiculos.secoes.tipo')}>
            <RhfField control={form.control} name="tipo" label={t('veiculos.cols.tipo')} required>
              {({ field, control }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger {...control}>
                    <SelectValue placeholder={t('veiculos.escolhaTipo')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_VEICULO.map((x) => (
                      <SelectItem key={x} value={x}>
                        {t(`veiculos.tipos.${x}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
          </CadastroSecao>
          <CadastroSecao titulo={t('veiculos.secoes.medidas')}>
            {numero('volumeMinimo', 'm²')}
            {numero('volumeMaximo', 'm²')}
            {numero('comprimento', 'm')}
            {numero('largura', 'm')}
          </CadastroSecao>
          <CadastroSecao titulo={t('veiculos.secoes.capacidade')}>
            {numero('capacidadePallets', t('veiculos.pallets'), 0)}
            {numero('capacidadeToneladas', 't')}
          </CadastroSecao>
        </form>
      }
    />
  )
}
