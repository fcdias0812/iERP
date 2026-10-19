import { useMemo } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import { DataTable, useUrlTableQuery, type DataTableColumn } from '@/components/data-table'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan } from '@/hooks/use-can'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatCnpj, formatCpf, formatNumber, formatPhone } from '@/lib/format'
import { ApiError } from '@/services/http'
import { listarTodosMotoristas } from '@/services/motoristas'
import type { Motorista, MotoristaResumo } from '@/services/types'
import {
  formParaInput,
  motoristaParaForm,
  motoristaSchema,
  novoMotoristaForm,
  NOVA_TRANSPORTADORA,
  SEM_TRANSPORTADORA,
  type MotoristaForm,
} from './motorista-schema'
import { motoristasHooks, useOpcoesTransportadoras } from './use-motoristas'

/* Relacionamento › Motoristas: lista + painel lateral (cadastro, edição e histórico). */

const STATUS = ['ativo', 'inativo']
const CAMPOS = ['nome', 'cpf', 'telefone', 'transportadora', 'status'] as const

export function MotoristasPage() {
  return (
    <RequirePermission permission="motoristas.ver">
      <Motoristas />
    </RequirePermission>
  )
}

function Motoristas() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aberto } = useSearch({ from: '/_app/motoristas/' })
  const podeCriar = useCan('motoristas.criar')

  const colunas = useMemo<DataTableColumn<MotoristaResumo>[]>(
    () => [
      {
        id: 'codigo',
        header: t('motoristas.cols.codigo'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 130,
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'nome',
        header: t('motoristas.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 260,
        mobile: 'title',
      },
      {
        id: 'cpf',
        header: t('motoristas.cols.cpf'),
        type: 'unique-text',
        accessor: (r) => r.cpf,
        size: 160,
        cell: (r) => <span className="font-mono">{formatCpf(r.cpf)}</span>,
      },
      {
        id: 'telefone',
        header: t('motoristas.cols.telefone'),
        type: 'unique-text',
        accessor: (r) => r.telefone,
        size: 170,
        cell: (r) => <span className="num">{formatPhone(r.telefone)}</span>,
      },
      {
        id: 'transportadoraNome',
        header: t('motoristas.cols.transportadora'),
        type: 'unique-text',
        accessor: (r) => r.transportadoraNome ?? '',
        size: 240,
        cell: (r) =>
          r.transportadoraId ? (
            <Link
              to="/transportadoras/$id"
              params={{ id: r.transportadoraId }}
              className="text-link underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {r.transportadoraNome}
            </Link>
          ) : (
            <span className="text-muted-foreground">{t('motoristas.semTransportadora')}</span>
          ),
      },
      {
        id: 'status',
        header: t('motoristas.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 120,
        mobile: 'badge',
        options: STATUS.map((s) => ({ value: s, label: s })),
      },
      {
        id: 'criadoEm',
        header: t('motoristas.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 140,
        hidden: true,
      },
    ],
    [t],
  )
  const [query, setQuery] = useUrlTableQuery(colunas)
  const lista = motoristasHooks.useLista(query)
  const resumoQ = motoristasHooks.useResumo()

  const abrir = (id: string) => void navigate({ to: '.', search: (s) => ({ ...s, aberto: id }) })
  const fechar = () => void navigate({ to: '.', search: (s) => ({ ...s, aberto: undefined }) })
  const kpi = (id: 'total' | 'ativos' | 'semTransportadora') => ({
    id,
    label: t(`motoristas.kpis.${id}`),
    value: resumoQ.data ? formatNumber(resumoQ.data[id]) : '—',
    loading: resumoQ.isPending,
  })

  return (
    <ListPage
      title={t('nav.motoristas')}
      description={t('motoristas.list.description')}
      kpis={[kpi('total'), kpi('ativos'), kpi('semTransportadora')]}
    >
      <DataTable
        id="motoristas"
        title={t('nav.motoristas')}
        exportName="motoristas"
        columns={colunas}
        getRowId={(r) => r.id}
        query={query}
        onQueryChange={setQuery}
        page={lista.data}
        loading={lista.isFetching}
        error={lista.isError && !lista.data}
        onRetry={() => void lista.refetch()}
        fetchAll={() => listarTodosMotoristas(query)}
        onRowClick={(r) => abrir(r.id)}
        onCreate={podeCriar ? () => abrir('novo') : undefined}
        createLabel={t('motoristas.newTitle')}
        empty={{
          title: t('motoristas.list.emptyTitle'),
          description: t('motoristas.list.emptyBody'),
        }}
        rowActions={(r) => (
          <DropdownMenuItem onSelect={() => abrir(r.id)}>
            <Eye aria-hidden />
            {t('common.open')}
          </DropdownMenuItem>
        )}
      />
      {aberto && (
        <MotoristaPainel
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={fechar}
        />
      )}
    </ListPage>
  )
}

/** Painel do motorista: carrega o registro (edição) e mostra o formulário. */
function MotoristaPainel({ id, onClose }: { id?: string; onClose: () => void }) {
  const detalhe = motoristasHooks.useDetalhe(id)
  if (id && detalhe.isPending)
    return (
      <div className="sr-only" aria-busy>
        <Skeleton />
      </div>
    )
  return (
    <MotoristaFormulario
      motorista={detalhe.data}
      erro={id ? detalhe.isError : false}
      onClose={onClose}
    />
  )
}

function MotoristaFormulario({
  motorista,
  erro,
  onClose,
}: {
  motorista?: Motorista
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = motoristasHooks.useSalvar(motorista?.id)
  const transicao = motoristasHooks.useTransicao()
  const form = useForm<MotoristaForm>({
    resolver: zodResolver(motoristaSchema),
    mode: 'onTouched',
    defaultValues: motorista ? motoristaParaForm(motorista) : novoMotoristaForm(),
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
    () => Object.fromEntries(CAMPOS.map((k) => [k, t(`motoristas.campos.${k}`)])),
    [t],
  )

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar
      .mutateAsync(formParaInput(motoristaSchema.parse(v)))
      .catch((e: unknown) => {
        // CPF/CNPJ repetido: erro no próprio campo.
        if (e instanceof ApiError && e.code === 'cpf_in_use')
          form.setError('cpf', { message: apiErrorMessage(e) }, { shouldFocus: true })
        if (e instanceof ApiError && e.code === 'cnpj_in_use')
          form.setError(
            'novaTransportadora.cnpj',
            { message: apiErrorMessage(e) },
            { shouldFocus: true },
          )
        return null
      })
    if (salvo) {
      form.reset(motoristaParaForm(salvo))
      onClose()
    }
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={
        motorista ? t('motoristas.editTitle', { name: motorista.nome }) : t('motoristas.newTitle')
      }
      descricao={t('motoristas.formDescription')}
      status={motorista ? <StatusBadge status={motorista.status} /> : undefined}
      formId="form-motorista"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={motorista ? 'motoristas.editar' : 'motoristas.criar'}
      acoes={motorista?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: motorista!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`motoristas.confirm.${acao}.title`, { name: motorista?.nome ?? '' }),
        corpo: t(`motoristas.confirm.${acao}.body`),
        botao: t(`motoristas.acoes.${acao}`),
      })}
      historico={
        motorista ? (
          <HistoricoTabela
            id="motorista-historico"
            titulo={t('cadastro.abas.historico')}
            historico={motorista.historico}
            exportName={`historico-${motorista.codigo}`}
            acoes={acoes}
            campos={campos}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-motorista"
          noValidate
          className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} className="sm:col-span-2" />}
          {motorista?.status === 'inativo' && (
            <Alert tone="inactive" title={t('motoristas.inativoTitle')} className="sm:col-span-2">
              {t('motoristas.inativoBody')}
            </Alert>
          )}
          <RhfField
            control={form.control}
            name="nome"
            label={t('motoristas.campos.nome')}
            required
            maxLength={160}
            className="sm:col-span-2"
          >
            {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
          </RhfField>
          <RhfField control={form.control} name="cpf" label={t('motoristas.campos.cpf')} required>
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
            name="telefone"
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
          <EscolhaTransportadora form={form} atual={motorista} />
        </form>
      }
    />
  )
}

/** Transportadora: nenhuma, uma da lista ou uma nova (entra em Transportadoras). */
function EscolhaTransportadora({
  form,
  atual,
}: {
  form: UseFormReturn<MotoristaForm>
  atual?: Motorista
}) {
  const { t } = useTranslation()
  const opcoes = useOpcoesTransportadoras()
  const escolha = useWatch({ control: form.control, name: 'transportadora' })
  // Inativas só aparecem se já forem a transportadora do motorista.
  const lista = (opcoes.data ?? []).filter(
    (o) => o.status === 'ativo' || o.id === atual?.transportadoraId,
  )
  return (
    <>
      <RhfField
        control={form.control}
        name="transportadora"
        label={t('motoristas.campos.transportadora')}
        className="sm:col-span-2"
      >
        {({ field, control }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_TRANSPORTADORA}>
                {t('motoristas.semTransportadora')}
              </SelectItem>
              {lista.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {`${o.nome} · ${formatCnpj(o.cnpj)}`}
                </SelectItem>
              ))}
              <SelectItem value={NOVA_TRANSPORTADORA}>
                {t('motoristas.novaTransportadora')}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </RhfField>
      {escolha === NOVA_TRANSPORTADORA && (
        <>
          <p className="type-caption text-muted-foreground sm:col-span-2">
            {t('motoristas.novaTransportadoraAjuda')}
          </p>
          <RhfField
            control={form.control}
            name="novaTransportadora.nome"
            label={t('motoristas.nomeTransportadora')}
            required
            maxLength={160}
          >
            {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
          </RhfField>
          <RhfField
            control={form.control}
            name="novaTransportadora.cnpj"
            label={t('motoristas.cnpjTransportadora')}
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
        </>
      )}
    </>
  )
}
