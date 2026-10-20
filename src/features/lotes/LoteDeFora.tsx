import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { EMPTY, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import type { EspelhoExterno, Ordem } from '@/services/types'
import { FotoMiniatura } from './FotoMiniatura'
import { useEspelho, useNomeDoSistema } from './lote-de-fora'

/*
 * Lote que veio de outro sistema (Gerenciamento de Projetos — pedido do usuário, 20/10/2026:
 * "o iERP vai servir aqui apenas para visualização"). Ele é criado, recebido e concluído LÁ: aqui
 * não há Editar, Receber, ocorrência nem documento. O que se vê:
 *  - o aviso (com o link para a ordem lá);
 *  - os dados da ordem como estão lá (aba Informações);
 *  - o ESPELHO, buscado ao vivo ao abrir: pesagens com a foto da balança, materiais e notas
 *    (aba Progresso) e os documentos (aba Documentos). Nada disso é copiado para o iERP.
 */

type Pesagem = EspelhoExterno['pesagens'][number]
type Material = EspelhoExterno['materiais'][number]
type Arquivo = NonNullable<EspelhoExterno['arquivos']>[number]

const SEM_PESAGENS: Pesagem[] = []
const SEM_MATERIAIS: Material[] = []
const SEM_ARQUIVOS: Arquivo[] = []
const POR_DATA: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'pesadoEm', desc: false }] }
const POR_PESO: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'pesoKg', desc: true }] }
const POR_ENVIO: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'enviadoEm', desc: true }] }

const kg = (v: number | null | undefined) => (v == null ? EMPTY : `${formatNumber(v)} kg`)

/** Link para a ordem no sistema de fora (abre em outra aba). */
export function LinkDeFora({ url, rotulo }: { url: string | null; rotulo: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 type-body text-link underline-offset-4 hover:underline"
    >
      {rotulo}
      <ExternalLink className="size-4" aria-hidden />
    </a>
  )
}

/** O aviso no topo do lote: ele é só para ver aqui. */
export function AvisoLoteDeFora({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const sistema = useNomeDoSistema(o)
  if (!o.externo) return null
  return (
    <Alert tone="info" title={t('lotes.deFora.titulo', { sistema })}>
      <p>{t('lotes.deFora.texto', { sistema })}</p>
      <LinkDeFora url={o.externo.url} rotulo={t('lotes.deFora.abrir', { sistema })} />
    </Alert>
  )
}

/** Aba Informações: a ordem como está no sistema de fora. */
export function DadosDeFora({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const sistema = useNomeDoSistema(o)
  const d = o.externoDados
  if (!d) return null
  const c = (k: string) => t(`lotes.deFora.campos.${k as 'numero'}`)
  const local = [d.cidade, d.uf].filter(Boolean).join('/')
  return (
    <Card role="region" aria-labelledby="lote-de-fora-dados" className="lg:col-span-2">
      <CardHeader>
        <CardTitle id="lote-de-fora-dados">{t('lotes.deFora.dados', { sistema })}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <KeyValueList
          columns={3}
          items={[
            {
              label: c('numero'),
              value: d.numero ? <span className="font-mono">{d.numero}</span> : null,
            },
            {
              label: c('lote'),
              value: d.lote ? <span className="font-mono">{d.lote}</span> : null,
            },
            { label: c('cliente'), value: d.cliente },
            { label: c('site'), value: d.site },
            { label: c('doca'), value: d.doca },
            {
              label: c('endereco'),
              value: [d.endereco, local].filter(Boolean).join(' – ') || null,
            },
            { label: c('pais'), value: d.pais },
            { label: c('transportadora'), value: d.transportadora },
            { label: c('pedidoEm'), value: d.pedidoEm ? formatDate(d.pedidoEm) : null },
            {
              label: c('coletaAgendadaEm'),
              value: d.coletaAgendadaEm ? formatDate(d.coletaAgendadaEm) : null,
            },
            {
              label: c('coletaPrevistaEm'),
              value: d.coletaPrevistaEm ? formatDate(d.coletaPrevistaEm) : null,
            },
            { label: c('chegadaEm'), value: d.chegadaEm ? formatDate(d.chegadaEm) : null },
            {
              label: c('previsto'),
              value:
                d.previstoPesoKg != null || d.previstoPallets != null
                  ? [
                      d.previstoPesoKg != null ? kg(d.previstoPesoKg) : null,
                      d.previstoPallets != null
                        ? t('lotes.deFora.pallets', { n: formatNumber(d.previstoPallets) })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : null,
            },
            {
              label: c('cod'),
              value: d.semCod
                ? t('lotes.deFora.semCod')
                : d.codNumero || d.codEm
                  ? [d.codNumero, d.codEm ? formatDate(d.codEm) : null].filter(Boolean).join(' · ')
                  : null,
            },
            { label: c('observacoes'), value: d.observacoes, full: true },
          ]}
        />
        <LinkDeFora url={o.externo?.url ?? null} rotulo={t('lotes.deFora.abrir', { sistema })} />
      </CardContent>
    </Card>
  )
}

function EspelhoIndisponivel({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const sistema = useNomeDoSistema(o)
  return (
    <Alert tone="warning" title={t('lotes.deFora.foraDoAr', { sistema })}>
      {t('lotes.deFora.foraDoArBody')}
    </Alert>
  )
}

/**
 * Aba Progresso: o que aconteceu lá. No Gerenciamento, o recebimento (pesagens com foto,
 * materiais e notas); no MSDC, o resumo da desmontagem (racks, máquinas, peças) e os materiais.
 */
export function RecebimentoDeFora({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const sistema = useNomeDoSistema(o)
  const q = useEspelho(o)
  return (
    <Card role="region" aria-labelledby="lote-de-fora-recebimento">
      <CardHeader>
        <CardTitle id="lote-de-fora-recebimento">
          {q.data && !q.data.temPesagens
            ? t('lotes.deFora.operacao', { sistema })
            : t('lotes.deFora.recebimento', { sistema })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {q.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError || !q.data ? (
          <EspelhoIndisponivel o={o} />
        ) : (
          <>
            {q.data.resumo.length > 0 && (
              <KeyValueList
                columns={3}
                items={[
                  // O resumo vem escrito pelo sistema de lá (é dado dele, como o nome da fase).
                  ...q.data.resumo.map((r) => ({
                    label: r.rotulo,
                    value: r.detalhe ? `${r.valor} · ${r.detalhe}` : r.valor,
                  })),
                  {
                    label: t('lotes.deFora.campos.seriais'),
                    value: q.data.seriais ? formatNumber(q.data.seriais) : null,
                  },
                ]}
              />
            )}
            {q.data.temPesagens && (
              <KeyValueList
                columns={3}
                items={[
                  {
                    label: t('lotes.deFora.campos.declarado'),
                    value:
                      [
                        kg(q.data.declarado.pesoKg),
                        q.data.declarado.pallets != null
                          ? t('lotes.deFora.pallets', { n: formatNumber(q.data.declarado.pallets) })
                          : null,
                      ]
                        .filter((x) => x && x !== EMPTY)
                        .join(' · ') || null,
                  },
                  {
                    label: t('lotes.deFora.campos.pesado'),
                    value: q.data.pesado
                      ? `${kg(q.data.pesado.pesoKg)} · ${t('lotes.deFora.pallets', {
                          n: formatNumber(q.data.pesado.pallets),
                        })}`
                      : null,
                  },
                  {
                    label: t('lotes.deFora.campos.seriais'),
                    value: q.data.seriais ? formatNumber(q.data.seriais) : null,
                  },
                ]}
              />
            )}
            {q.data.temPesagens && <Pesagens o={o} pesagens={q.data.pesagens} />}
            <Materiais o={o} materiais={q.data.materiais} />
            {q.data.notas.length > 0 && (
              <section aria-labelledby="lote-de-fora-notas" className="flex flex-col gap-2">
                <h3 id="lote-de-fora-notas" className="type-label">
                  {t('lotes.deFora.notas')}
                </h3>
                <ul className="flex flex-col gap-2">
                  {q.data.notas.map((n, i) => (
                    <li key={i} className="flex flex-col gap-0.5 rounded-md border p-3">
                      <p className="type-body whitespace-pre-line">{n.texto}</p>
                      <p className="type-caption text-muted-foreground">
                        {[n.autor, n.data ? formatDate(n.data) : null].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Pesagens({ o, pesagens }: { o: Ordem; pesagens: Pesagem[] }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(POR_DATA)
  const pessoas = useMemo(
    () => [...new Set(pesagens.map((p) => p.pesadoPor).filter(Boolean))].sort() as string[],
    [pesagens],
  )
  const colunas = useMemo<DataTableColumn<Pesagem>[]>(
    () => [
      {
        id: 'pesoKg',
        header: t('lotes.deFora.cols.peso'),
        type: 'number',
        accessor: (r) => r.pesoKg,
        size: 150,
        total: true,
        mobile: 'title',
        cell: (r) => <span className="num">{kg(r.pesoKg)}</span>,
      },
      {
        id: 'pallets',
        header: t('lotes.deFora.cols.pallets'),
        type: 'number',
        accessor: (r) => r.pallets,
        size: 120,
        total: true,
        cell: (r) => (
          <span className="num">{r.pallets == null ? EMPTY : formatNumber(r.pallets)}</span>
        ),
      },
      {
        id: 'conteudo',
        header: t('lotes.deFora.cols.conteudo'),
        type: 'unique-text',
        accessor: (r) => r.conteudo,
        size: 220,
      },
      {
        id: 'pesadoPor',
        header: t('lotes.deFora.cols.pesadoPor'),
        type: 'enum',
        accessor: (r) => r.pesadoPor,
        size: 170,
        options: pessoas.map((p) => ({ value: p, label: p })),
      },
      {
        id: 'pesadoEm',
        header: t('lotes.deFora.cols.pesadoEm'),
        type: 'date',
        accessor: (r) => r.pesadoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.pesadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.pesadoEm),
      },
      {
        id: 'foto',
        header: t('lotes.deFora.cols.foto'),
        type: 'boolean',
        accessor: (r) => Boolean(r.fotoUrl),
        size: 110,
        sortable: false,
        cell: (r) =>
          r.fotoUrl ? (
            <FotoMiniatura
              className="size-9"
              src={r.fotoUrl}
              titulo={t('lotes.deFora.fotoTitulo', { lote: o.codigo, peso: kg(r.pesoKg) })}
            />
          ) : (
            EMPTY
          ),
        exportValue: (r) => r.fotoUrl,
      },
    ],
    [t, o.codigo, pessoas],
  )
  return (
    <section aria-labelledby="lote-de-fora-pesagens" className="flex flex-col gap-2">
      <h3 id="lote-de-fora-pesagens" className="type-label">
        {t('lotes.deFora.pesagens')}
      </h3>
      <DataTable
        id="lote-de-fora-pesagens"
        title={t('lotes.deFora.pesagens')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={pesagens.length ? pesagens : SEM_PESAGENS}
        query={query}
        onQueryChange={setQuery}
        exportName={`pesagens-${o.codigo}`}
        empty={{
          title: t('lotes.deFora.pesagensVazioTitle'),
          description: t('lotes.deFora.pesagensVazioBody'),
        }}
      />
    </section>
  )
}

function Materiais({ o, materiais }: { o: Ordem; materiais: Material[] }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(POR_PESO)
  const tipos = useMemo(
    () => [...new Set(materiais.map((m) => m.tipo).filter(Boolean))].sort() as string[],
    [materiais],
  )
  const linhas = useMemo(() => materiais.map((m, i) => ({ ...m, id: String(i) })), [materiais])
  const colunas = useMemo<DataTableColumn<Material & { id: string }>[]>(
    () => [
      {
        id: 'tipo',
        header: t('lotes.deFora.cols.tipo'),
        type: 'enum',
        accessor: (r) => r.tipo,
        size: 180,
        mobile: 'title',
        options: tipos.map((x) => ({ value: x, label: x })),
      },
      {
        id: 'descricao',
        header: t('lotes.deFora.cols.descricao'),
        type: 'unique-text',
        accessor: (r) => r.descricao,
        size: 240,
      },
      {
        id: 'embalagem',
        header: t('lotes.deFora.cols.embalagem'),
        type: 'unique-text',
        accessor: (r) => r.embalagem,
        size: 160,
      },
      {
        id: 'pesoKg',
        header: t('lotes.deFora.cols.peso'),
        type: 'number',
        accessor: (r) => r.pesoKg,
        size: 150,
        total: true,
        cell: (r) => <span className="num">{kg(r.pesoKg)}</span>,
      },
    ],
    [t, tipos],
  )
  if (!materiais.length) return null
  return (
    <section aria-labelledby="lote-de-fora-materiais" className="flex flex-col gap-2">
      <h3 id="lote-de-fora-materiais" className="type-label">
        {t('lotes.deFora.materiais')}
      </h3>
      <DataTable
        id="lote-de-fora-materiais"
        title={t('lotes.deFora.materiais')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={linhas.length ? linhas : (SEM_MATERIAIS as (Material & { id: string })[])}
        query={query}
        onQueryChange={setQuery}
        exportName={`materiais-${o.codigo}`}
      />
    </section>
  )
}

/** Aba Documentos: os documentos que estão lá (abrem no sistema de fora, com o login de lá). */
export function DocumentosDeFora({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const sistema = useNomeDoSistema(o)
  const q = useEspelho(o)
  const [query, setQuery] = useState<TableQuery>(POR_ENVIO)
  const arquivos = q.data?.arquivos ?? SEM_ARQUIVOS
  // O sistema não compartilha os arquivos (o MSDC: o anexo de lá exige o login de lá).
  const soLa = q.data?.arquivos === null
  const tipos = useMemo(
    () => [...new Set(arquivos.map((a) => a.tipo).filter(Boolean))].sort() as string[],
    [arquivos],
  )
  const colunas = useMemo<DataTableColumn<Arquivo>[]>(
    () => [
      {
        id: 'nome',
        header: t('lotes.documentos.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 300,
        mobile: 'title',
        cell: (r) =>
          r.url ? (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline-offset-4 hover:underline"
            >
              {r.nome}
            </a>
          ) : (
            r.nome
          ),
      },
      {
        id: 'tipo',
        header: t('lotes.documentos.cols.tipo'),
        type: 'enum',
        accessor: (r) => r.tipo,
        size: 180,
        options: tipos.map((x) => ({ value: x, label: x })),
      },
      {
        id: 'enviadoEm',
        header: t('lotes.documentos.cols.enviadoEm'),
        type: 'date',
        accessor: (r) => r.enviadoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.enviadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.enviadoEm),
      },
      {
        id: 'enviadoPor',
        header: t('lotes.documentos.cols.enviadoPor'),
        type: 'unique-text',
        accessor: (r) => r.enviadoPor,
        size: 170,
      },
    ],
    [t, tipos],
  )
  return (
    <section aria-labelledby="lote-de-fora-documentos" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="lote-de-fora-documentos" className="type-section-title">
          {t('lotes.deFora.documentos', { sistema })}
        </h2>
        <p className="type-caption text-muted-foreground">
          {t('lotes.deFora.documentosAjuda', { sistema })}
        </p>
      </div>
      {q.isError ? (
        <EspelhoIndisponivel o={o} />
      ) : soLa ? (
        <Alert tone="info" title={t('lotes.deFora.documentosSoLa', { sistema })}>
          <LinkDeFora url={o.externo?.url ?? null} rotulo={t('lotes.deFora.abrir', { sistema })} />
        </Alert>
      ) : (
        <DataTable
          id="lote-de-fora-documentos"
          title={t('lotes.deFora.documentos', { sistema })}
          columns={colunas}
          getRowId={(r) => r.id}
          data={arquivos}
          loading={q.isPending}
          query={query}
          onQueryChange={setQuery}
          exportName={`documentos-${o.codigo}`}
          empty={{
            title: t('lotes.documentos.vazioTitle'),
            description: t('lotes.deFora.documentosVazio', { sistema }),
          }}
        />
      )}
    </section>
  )
}
