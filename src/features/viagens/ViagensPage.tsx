import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Search, Truck, X } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { AppLink } from '@/components/layout/AppLink'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SeletorPeriodo } from '@/features/historico/SeletorPeriodo'
import { desdeDo, type Periodo } from '@/features/historico/periodo'
import { apiErrorMessage } from '@/lib/api-errors'
import { EMPTY, formatDate, formatNumber, formatTime } from '@/lib/format'
import type { Viagem } from '@/services/types'
import {
  agruparViagens,
  diaRelativo,
  gravarModo,
  lerModo,
  MODOS,
  type ModoAgrupar,
} from './agrupar'
import { CardViagem } from './CardViagem'
import { CartaoMapa } from './CartaoMapa'
import { ChatViagemSheet } from './ChatViagemSheet'
import { PainelViagem } from './PainelViagem'
import { useReplay } from './use-replay'
import { useCienteEmergencia, useFinalizarViagem, useViagem, useViagens } from './use-viagens'
import type { AbaViagens } from './viagens-search'

/*
 * Ordens › Viagens (pedido do usuário, 20/10/2026): "Ao agendar uma ordem, ele gera em viagens um
 * card com a viagem do lote podendo acompanhar ele no mapa."
 *  - Em andamento: os cards (aguardando motorista, na rua, chegou) agrupados por dia da coleta e
 *    cliente, e o mapa ao vivo (atualiza a cada 5 s) com trânsito, postos/balanças e os locais;
 *  - Finalizadas: a tabela das viagens encerradas e o REPLAY do trajeto no mapa.
 * As viagens dos lotes do Gerenciamento de Projetos e do MSDC aparecem só para ver.
 */

const MapaViagem = lazy(() => import('./MapaViagem'))

/** Busca sem acento e sem maiúscula. */
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function ViagensPage() {
  return (
    <RequirePermission permission="ordens.viagens.ver">
      <Viagens />
    </RequirePermission>
  )
}

function Viagens() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/ordens/viagens' })
  const aba: AbaViagens = search.aba ?? 'em-andamento'
  const abertas = useViagens('abertas')
  const [periodo, setPeriodo] = useState<Periodo>('90')
  const desde = useMemo(() => desdeDo(periodo) ?? undefined, [periodo])
  const finalizadas = useViagens('finalizadas', desde)
  const [finalizar, setFinalizar] = useState<Viagem | null>(null)
  const encerrar = useFinalizarViagem()
  const ciente = useCienteEmergencia()

  const ir = (s: { aba?: AbaViagens; viagem?: string; chat?: string }) =>
    void navigate({ to: '/ordens/viagens', search: s, replace: true })
  const trocarAba = (a: AbaViagens) => ir({ aba: a === 'em-andamento' ? undefined : a })
  const escolher = (id: string | undefined) => ir({ aba: search.aba, viagem: id })
  const abrirChat = (id: string | undefined) =>
    ir({ aba: search.aba, viagem: search.viagem, chat: id })

  const todas = useMemo(
    () => [...(abertas.data?.viagens ?? []), ...(finalizadas.data?.viagens ?? [])],
    [abertas.data, finalizadas.data],
  )
  const doChat = todas.find((v) => v.id === search.chat) ?? null
  const resposta = abertas.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('nav.ordens.viagens')}
        description={
          resposta
            ? t('viagens.atualizado', { hora: formatTime(resposta.atualizadoEm) })
            : t('viagens.descricao')
        }
      />
      {resposta && !resposta.configurado && (
        <Alert
          tone="info"
          title={t('viagens.semRastreador.titulo')}
          action={
            <Button size="sm" variant="secondary" asChild>
              <AppLink to="/admin/integracao">{t('viagens.semRastreador.acao')}</AppLink>
            </Button>
          }
        >
          {t('viagens.semRastreador.texto')}
        </Alert>
      )}
      {resposta?.erro && (
        <Alert tone="warning" title={t('viagens.erroRastreador')}>
          {resposta.erro}
        </Alert>
      )}
      {abertas.isError && !resposta && (
        <Alert tone="danger" title={t('apiErrors.server')}>
          {apiErrorMessage(abertas.error)}
        </Alert>
      )}

      <ButtonGroup aria-label={t('viagens.abas.rotulo')}>
        {(['em-andamento', 'finalizadas'] as const).map((a) => (
          <Button
            key={a}
            size="sm"
            variant={aba === a ? 'default' : 'secondary'}
            aria-pressed={aba === a}
            onClick={() => trocarAba(a)}
          >
            {t(`viagens.abas.${a}`)}
            {a === 'em-andamento' && resposta && (
              <span className="num">({formatNumber(resposta.viagens.length)})</span>
            )}
          </Button>
        ))}
      </ButtonGroup>

      {aba === 'em-andamento' ? (
        <EmAndamento
          viagens={resposta?.viagens}
          temTransito={resposta?.temTransito ?? false}
          carregando={abertas.isPending}
          escolhidaId={search.viagem ?? null}
          onEscolher={escolher}
          onChat={abrirChat}
          onFinalizar={setFinalizar}
          onCiente={(v) => ciente.mutate(v.id)}
        />
      ) : (
        <Finalizadas
          viagens={finalizadas.data?.viagens}
          carregando={finalizadas.isFetching}
          erro={finalizadas.isError}
          onRetry={() => void finalizadas.refetch()}
          periodo={periodo}
          onPeriodo={setPeriodo}
          escolhidaId={search.viagem ?? null}
          onEscolher={escolher}
          onChat={abrirChat}
        />
      )}

      <ChatViagemSheet viagem={doChat} onFechar={() => abrirChat(undefined)} />
      <ConfirmDialog
        open={Boolean(finalizar)}
        onOpenChange={(aberto) => !aberto && setFinalizar(null)}
        title={t('viagens.finalizar.titulo', { code: finalizar?.loteCodigo ?? '' })}
        description={
          finalizar?.status === 'em_rota'
            ? t('viagens.finalizar.avisoEmRota')
            : t('viagens.finalizar.texto')
        }
        confirmLabel={t('viagens.finalizar.botao')}
        onConfirm={async () => {
          if (finalizar) await encerrar.mutateAsync(finalizar.id).catch(() => undefined)
          setFinalizar(null)
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------ em andamento */

const VAZIA: Viagem[] = []

function EmAndamento({
  viagens = VAZIA,
  temTransito,
  carregando,
  escolhidaId,
  onEscolher,
  onChat,
  onFinalizar,
  onCiente,
}: {
  viagens?: Viagem[]
  temTransito: boolean
  carregando: boolean
  escolhidaId: string | null
  onEscolher: (id: string | undefined) => void
  onChat: (id: string) => void
  onFinalizar: (v: Viagem) => void
  onCiente: (v: Viagem) => void
}) {
  const { t } = useTranslation()
  const [modo, setModo] = useState<ModoAgrupar>(lerModo)
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const q = semAcento(busca.trim())
    if (!q) return viagens
    return viagens.filter((v) =>
      semAcento(
        [v.loteCodigo, v.codigoRastreio, v.clienteNome, v.siteCodigo, v.motoristaNome, v.placa]
          .filter(Boolean)
          .join(' '),
      ).includes(q),
    )
  }, [viagens, busca])
  const grupos = useMemo(() => agruparViagens(filtradas, modo), [filtradas, modo])

  const escolhida = viagens.find((v) => v.id === escolhidaId) ?? null
  const tituloDoGrupo = (dia: string | null | undefined, cliente: string | null | undefined) => {
    const partes: string[] = []
    if (dia !== undefined) {
      if (!dia) partes.push(t('viagens.grupos.semData'))
      else {
        const rel = diaRelativo(dia)
        const data = formatDate(`${dia}T12:00:00Z`)
        partes.push(rel ? `${data} (${t(`viagens.grupos.${rel}`)})` : data)
      }
    }
    if (cliente !== undefined) partes.push(cliente ?? t('viagens.grupos.semCliente'))
    return partes.join(' · ')
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-labelledby="viagens-lista" className="flex flex-col gap-3">
        <h2 id="viagens-lista" className="sr-only">
          {t('viagens.lista')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t('viagens.buscar')}
              aria-label={t('viagens.buscar')}
              className="pl-8"
            />
          </div>
          <Select
            value={modo}
            onValueChange={(v) => {
              setModo(v as ModoAgrupar)
              gravarModo(v as ModoAgrupar)
            }}
          >
            <SelectTrigger className="w-auto min-w-44" aria-label={t('viagens.grupos.rotulo')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODOS.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`viagens.grupos.modos.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {carregando && <Skeleton className="h-40 w-full" />}
        {!carregando && viagens.length === 0 && (
          <EmptyState
            size="sm"
            icon={<Truck />}
            title={t('viagens.vazio.titulo')}
            description={t('viagens.vazio.texto')}
          />
        )}
        {!carregando && viagens.length > 0 && filtradas.length === 0 && (
          <p className="type-caption text-muted-foreground">{t('viagens.semResultado')}</p>
        )}
        {grupos.map((g) => (
          <section key={g.chave} aria-label={tituloDoGrupo(g.dia, g.cliente) || t('viagens.lista')}>
            {(g.dia !== undefined || g.cliente !== undefined) && (
              <h3 className="mb-2 type-label text-muted-foreground">
                {tituloDoGrupo(g.dia, g.cliente)}{' '}
                <span className="num">({formatNumber(g.itens.length)})</span>
              </h3>
            )}
            <ul className="flex flex-col gap-2">
              {g.itens.map((v) => (
                <li key={v.id}>
                  <CardViagem
                    v={v}
                    escolhida={v.id === escolhidaId}
                    onEscolher={() => {
                      onEscolher(v.id === escolhidaId ? undefined : v.id)
                      // Celular/tablet: o mapa fica embaixo da lista — leva até ele.
                      if (v.id !== escolhidaId && !window.matchMedia('(min-width: 80rem)').matches)
                        document
                          .getElementById('mapa-viagens')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    onChat={() => onChat(v.id)}
                    onFinalizar={() => onFinalizar(v)}
                    onCiente={() => onCiente(v)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>

      <CartaoMapa
        id="mapa-viagens"
        className="xl:sticky xl:top-[calc(var(--navbar-h)+1rem)]"
        viagens={viagens}
        escolhidaId={escolhidaId}
        onEscolher={onEscolher}
        temTransito={temTransito}
        titulo={
          escolhida
            ? t('viagens.mapa.daViagem', { code: escolhida.loteCodigo })
            : t('viagens.mapa.titulo')
        }
        rotulo={t('viagens.mapa.rotulo')}
        alto
      />
    </div>
  )
}

/* ------------------------------------------------------------ finalizadas */

const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'terminadaEm', desc: true }] }

function Finalizadas({
  viagens = VAZIA,
  carregando,
  erro,
  onRetry,
  periodo,
  onPeriodo,
  escolhidaId,
  onEscolher,
  onChat,
}: {
  viagens?: Viagem[]
  carregando: boolean
  erro: boolean
  onRetry: () => void
  periodo: Periodo
  onPeriodo: (p: Periodo) => void
  escolhidaId: string | null
  onEscolher: (id: string | undefined) => void
  onChat: (id: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const escolhida = viagens.find((v) => v.id === escolhidaId) ?? null

  const clientes = useMemo(() => [...new Set(viagens.map((v) => v.clienteNome))].sort(), [viagens])
  const colunas = useMemo<DataTableColumn<Viagem>[]>(
    () => [
      {
        id: 'loteCodigo',
        header: t('viagens.cols.lote'),
        type: 'unique-text',
        accessor: (r) => r.loteCodigo,
        size: 130,
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.loteCodigo}</span>,
      },
      {
        id: 'status',
        header: t('viagens.cols.status'),
        type: 'status',
        accessor: (r) => `viagem_${r.status}`,
        size: 160,
        mobile: 'badge',
        options: (['finalizada', 'cancelada'] as const).map((s) => ({
          value: `viagem_${s}`,
          label: t(`status.viagem_${s}`),
        })),
      },
      {
        id: 'clienteNome',
        header: t('viagens.cols.cliente'),
        type: 'enum',
        accessor: (r) => r.clienteNome,
        size: 180,
        options: clientes.map((c) => ({ value: c, label: c })),
      },
      {
        id: 'motoristaNome',
        header: t('viagens.cols.motorista'),
        type: 'unique-text',
        accessor: (r) => r.motoristaNome,
        size: 180,
      },
      {
        id: 'placa',
        header: t('viagens.cols.placa'),
        type: 'unique-text',
        accessor: (r) => r.placa,
        size: 110,
        cell: (r) => <span className="font-mono">{r.placa ?? EMPTY}</span>,
      },
      {
        id: 'iniciadaEm',
        header: t('viagens.cols.iniciada'),
        type: 'date',
        accessor: (r) => r.iniciadaEm,
        size: 150,
      },
      {
        id: 'terminadaEm',
        header: t('viagens.cols.terminada'),
        type: 'date',
        accessor: (r) => r.terminadaEm,
        size: 150,
      },
      {
        id: 'finalizadaPor',
        header: t('viagens.cols.finalizadaPor'),
        type: 'enum',
        accessor: (r) => r.finalizadaPor,
        size: 170,
        options: (['motorista', 'operador', 'recebimento', 'rastreador'] as const).map((f) => ({
          value: f,
          label: t(`viagens.finalizadaPor.${f}`),
        })),
      },
      {
        id: 'distancia',
        header: t('viagens.cols.distancia'),
        type: 'number',
        accessor: (r) => (r.distanciaMetros === null ? null : r.distanciaMetros / 1000),
        size: 130,
        cell: (r) =>
          r.distanciaMetros === null
            ? EMPTY
            : `${formatNumber(r.distanciaMetros / 1000, { maximumFractionDigits: 1 })} km`,
      },
      {
        id: 'totalPontos',
        header: t('viagens.cols.pontos'),
        type: 'number',
        accessor: (r) => r.totalPontos,
        size: 110,
        hidden: true,
      },
    ],
    [t, clientes],
  )

  return (
    <div className="flex flex-col gap-4">
      <SeletorPeriodo periodo={periodo} onChange={onPeriodo} />
      {escolhida && (
        <ReplayDaViagem
          key={escolhida.id}
          viagem={escolhida}
          onChat={() => onChat(escolhida.id)}
          onFechar={() => onEscolher(undefined)}
        />
      )}
      <DataTable
        id="viagens-finalizadas"
        title={t('viagens.abas.finalizadas')}
        exportName="viagens-finalizadas"
        columns={colunas}
        getRowId={(r) => r.id}
        data={viagens}
        query={query}
        onQueryChange={setQuery}
        loading={carregando}
        error={erro}
        onRetry={onRetry}
        onRowClick={(r) => onEscolher(r.id === escolhidaId ? undefined : r.id)}
        highlightRow={(r) => r.id === escolhidaId}
        empty={{ title: t('viagens.finalizadasVazio') }}
      />
    </div>
  )
}

/** O replay de UMA viagem (montado de novo a cada viagem: começa sempre do início). */
function ReplayDaViagem({
  viagem,
  onChat,
  onFechar,
}: {
  viagem: Viagem
  onChat: () => void
  onFechar: () => void
}) {
  const { t } = useTranslation()
  const detalhe = useViagem(viagem.id, false)
  const d = detalhe.data?.id === viagem.id ? detalhe.data : undefined
  const replay = useReplay(d?.trajeto.length ?? 0)
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('viagens.replay.titulo', { code: viagem.loteCodigo })}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {viagem.tripId !== null && (
            <Button size="sm" variant="secondary" onClick={onChat}>
              {t('viagens.chat.abrir')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onFechar}>
            <X aria-hidden />
            {t('viagens.replay.fechar')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!d ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <MapaViagem
                viagens={[viagem]}
                selecionada={d}
                selecionadaId={viagem.id}
                camadas={{ transito: false, pois: false, pontos: true }}
                pois={[]}
                replay={replay.indice}
                rotulo={t('viagens.replay.mapa', { code: viagem.loteCodigo })}
              />
            </Suspense>
            <PainelViagem d={d} replay={replay} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
