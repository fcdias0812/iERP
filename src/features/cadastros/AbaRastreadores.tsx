import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskedInput } from '@/components/ui/masked-input'
import { KeyValueList } from '@/components/ui/metadata'
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { EMPTY, formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { isValidPlate } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import type { EstadoRastreador, Rastreador } from '@/services/types'
import { PainelCarregando } from './comum'
import { useRotulosCadastro } from './rotulos'
import {
  useEditarRastreador,
  useLerGpsAgora,
  useRastreador,
  useRastreadores,
  useTransicaoRastreador,
} from './use-rastreadores'

/*
 * Cadastros › Rastreadores GPS (22/10/2026): os aparelhos dos caminhões. Como no 1.0, eles
 * aparecem sozinhos na leitura do servidor de GPS (Administração › Integração › "Servidor de GPS
 * dos caminhões"); aqui se põe a placa e a descrição e se inativa/reativa. A viagem usa o aparelho
 * pelo botão "Usar rastreador" do caminhão (Ordens › Viagens ou o lote).
 */

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'deviceId', desc: false }] }
const VAZIO: Rastreador[] = []
const ESTADOS: EstadoRastreador[] = [
  'online',
  'sem_satelite',
  'gps_com_problema',
  'sem_conexao',
  'nunca_conectou',
]
const CAMPOS = ['placa', 'descricao', 'status'] as const
const kmh = (ms: number | null) => (ms === null ? null : Math.round(ms * 3.6))

export function AbaRastreadores({
  aberto,
  onAbrir,
}: {
  aberto: string | undefined
  onAbrir: (id: string | undefined) => void
}) {
  const { t } = useTranslation()
  const lista = useRastreadores()
  const ler = useLerGpsAgora()
  const [query, setQuery] = useState<TableQuery>(ORDEM)

  const colunas = useMemo<DataTableColumn<Rastreador>[]>(
    () => [
      {
        id: 'deviceId',
        header: t('cadastros.rastreadores.cols.aparelho'),
        type: 'unique-text',
        accessor: (r) => r.deviceId,
        size: 200,
        mobile: 'title',
        cell: (r) => (
          <span className="flex flex-col">
            <span className="font-mono">{r.deviceId}</span>
            {r.descricao && (
              <span className="type-caption text-muted-foreground">{r.descricao}</span>
            )}
          </span>
        ),
      },
      {
        id: 'placa',
        header: t('cadastros.rastreadores.cols.placa'),
        type: 'unique-text',
        accessor: (r) => r.placa,
        size: 120,
        cell: (r) => <span className="font-mono">{r.placa ?? EMPTY}</span>,
      },
      {
        id: 'estado',
        header: t('cadastros.rastreadores.cols.situacao'),
        type: 'status',
        accessor: (r) => (r.status === 'inativo' ? 'inativo' : `rastreador_${r.estado}`),
        size: 170,
        options: [
          ...ESTADOS.map((e) => ({
            value: `rastreador_${e}`,
            label: t(`status.rastreador_${e}`),
          })),
          { value: 'inativo', label: t('status.inativo') },
        ],
        cell: (r) =>
          r.status === 'inativo' ? (
            <StatusBadge status="inativo" />
          ) : (
            <StatusBadge status={`rastreador_${r.estado}`} />
          ),
      },
      {
        id: 'ultimoContatoEm',
        header: t('cadastros.rastreadores.cols.ultimoContato'),
        type: 'date',
        accessor: (r) => r.ultimoContatoEm,
        size: 170,
        cell: (r) =>
          r.ultimoContatoEm ? (
            <span title={formatDateTime(r.ultimoContatoEm)}>
              {formatRelative(r.ultimoContatoEm)}
            </span>
          ) : (
            EMPTY
          ),
      },
      {
        id: 'satelites',
        header: t('cadastros.rastreadores.cols.gps'),
        type: 'number',
        accessor: (r) => r.satelites,
        size: 110,
        cell: (r) => (
          <span className="num">
            {[r.fix, r.satelites !== null ? `${formatNumber(r.satelites)} sat.` : null]
              .filter(Boolean)
              .join(' · ') || EMPTY}
          </span>
        ),
      },
      {
        id: 'ultimaPosicao',
        header: t('cadastros.rastreadores.cols.ultimaPosicao'),
        type: 'unique-text',
        accessor: (r) =>
          r.ultimaLatitude !== null ? `${r.ultimaLatitude}, ${r.ultimaLongitude}` : null,
        size: 200,
        cell: (r) =>
          r.ultimaLatitude !== null && r.ultimaLongitude !== null ? (
            <a
              href={`https://www.google.com/maps?q=${r.ultimaLatitude},${r.ultimaLongitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link num underline-offset-4 hover:underline"
            >
              {[
                `${r.ultimaLatitude.toFixed(5)}, ${r.ultimaLongitude.toFixed(5)}`,
                kmh(r.ultimaVelocidade) !== null ? `${kmh(r.ultimaVelocidade)} km/h` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </a>
          ) : (
            EMPTY
          ),
      },
      {
        id: 'viagem',
        header: t('cadastros.rastreadores.cols.viagem'),
        type: 'unique-text',
        accessor: (r) => r.viagem?.loteCodigo ?? null,
        size: 160,
        cell: (r) =>
          r.viagem ? (
            <Link
              to="/ordens/viagens"
              className="font-mono text-link underline-offset-4 hover:underline"
            >
              {r.viagem.loteCodigo}
            </Link>
          ) : (
            EMPTY
          ),
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-4">
      {lista.isError && <Alert tone="danger" title={t('apiErrors.server')} />}
      <DataTable
        id="cadastros-rastreadores"
        title={t('cadastros.abas.rastreadores')}
        exportName="rastreadores-gps"
        columns={colunas}
        getRowId={(r) => r.id}
        data={lista.data ?? VAZIO}
        loading={lista.isPending}
        query={query}
        onQueryChange={setQuery}
        onRowClick={(r) => onAbrir(r.id)}
        toolbar={
          <Can permission="cadastros.rastreadores.editar" fallback="disable">
            <Button variant="secondary" loading={ler.isPending} onClick={() => ler.mutate()}>
              {!ler.isPending && <RefreshCw aria-hidden />}
              {t('cadastros.rastreadores.lerAgora')}
            </Button>
          </Can>
        }
        empty={{
          title: t('cadastros.rastreadores.vazio'),
          description: t('cadastros.rastreadores.vazioBody'),
        }}
      />
      {aberto && <RastreadorPainel id={aberto} onClose={() => onAbrir(undefined)} />}
    </div>
  )
}

const schema = z
  .object({ placa: z.string(), descricao: z.string().trim().max(120) })
  .refine((v) => !v.placa || isValidPlate(v.placa), {
    path: ['placa'],
    message: 'validation.plate',
  })
type Form = z.input<typeof schema>

function RastreadorPainel({ id, onClose }: { id: string; onClose: () => void }) {
  const detalhe = useRastreador(id)
  if (detalhe.isPending) return <PainelCarregando />
  if (!detalhe.data) return null
  return <RastreadorFormulario r={detalhe.data} onClose={onClose} />
}

function RastreadorFormulario({
  r,
  onClose,
}: {
  r: NonNullable<ReturnType<typeof useRastreador>['data']>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = useEditarRastreador(r.id)
  const transicao = useTransicaoRastreador()
  const rotulos = useRotulosCadastro(CAMPOS, 'cadastros.rastreadores.campos')
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { placa: r.placa ?? '', descricao: r.descricao ?? '' },
  })
  const enviar = form.handleSubmit(async (v) => {
    const ok = await salvar
      .mutateAsync({
        placa: v.placa ? v.placa.toUpperCase() : null,
        descricao: v.descricao || null,
      })
      .catch(() => null)
    if (ok) {
      form.reset(v)
      onClose()
    }
  })
  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={r.deviceId}
      descricao={t('cadastros.rastreadores.descricao')}
      status={
        r.status === 'inativo' ? (
          <StatusBadge status="inativo" />
        ) : (
          <StatusBadge status={`rastreador_${r.estado}`} />
        )
      }
      formId="form-rastreador"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao="cadastros.rastreadores.editar"
      acoes={r.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: r.id, acao: acao as 'inativar' })}
      textosAcao={(acao) => ({
        titulo: t(`cadastros.confirm.${acao}.title`, { name: r.deviceId }),
        corpo: t('cadastros.rastreadores.confirm'),
        botao: t(`cadastros.acoes.${acao}`),
      })}
      historico={
        <HistoricoTabela
          id="rastreador-historico"
          titulo={t('cadastro.abas.historico')}
          historico={r.historico}
          exportName={`historico-${r.deviceId}`}
          acoes={rotulos.acoes}
          campos={rotulos.campos}
        />
      }
      dados={
        <form
          id="form-rastreador"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <CadastroSecao titulo={t('cadastros.rastreadores.secao')}>
            <RhfField
              control={form.control}
              name="placa"
              label={t('cadastros.rastreadores.cols.placa')}
              help={t('cadastros.rastreadores.placaAjuda')}
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
            <RhfField
              control={form.control}
              name="descricao"
              label={t('cadastros.rastreadores.campos.descricao')}
              maxLength={120}
            >
              {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
            </RhfField>
          </CadastroSecao>
          <CadastroSecao titulo={t('cadastros.rastreadores.situacaoTitulo')} colunas={1}>
            <KeyValueList
              items={[
                {
                  label: t('cadastros.rastreadores.cols.ultimoContato'),
                  value: r.ultimoContatoEm ? formatDateTime(r.ultimoContatoEm) : null,
                },
                { label: t('cadastros.rastreadores.firmware'), value: r.firmware },
                {
                  label: t('cadastros.rastreadores.pontosPerdidos'),
                  value: <span className="num">{formatNumber(r.pontosPerdidos)}</span>,
                },
                {
                  label: t('cadastros.rastreadores.cols.viagem'),
                  value: r.viagem?.loteCodigo,
                },
              ]}
            />
          </CadastroSecao>
        </form>
      }
    />
  )
}
