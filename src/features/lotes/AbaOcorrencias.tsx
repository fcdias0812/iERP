import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, Camera, Pencil } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { TextoTraduzido } from '@/components/ui/localized-text'
import { useCan } from '@/hooks/use-can'
import { useTraducao } from '@/hooks/use-traducao'
import { formatDateTime, formatNumber } from '@/lib/format'
import { textoEm } from '@/lib/localized-text'
import { urlFotoOcorrencia } from '@/services/ordens'
import type { OcorrenciaLote, Ordem } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { useCancelarOcorrencia, useSalvarOcorrencia } from '@/features/ordens/use-ordens'
import { FotoMiniatura } from './FotoMiniatura'
import { CATEGORIAS, MOMENTOS } from './ocorrencia'

/*
 * Ocorrências do lote (coleta, trajeto, recebimento): tabela com filtros; a linha expandida
 * mostra o texto inteiro e as fotos. Registrar/corrigir no painel lateral; cancelar pede
 * confirmação (a ocorrência fica, como cancelada, e tudo vai para o histórico do lote).
 */

const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'numero', desc: true }] }
const SEM_OCORRENCIAS: OcorrenciaLote[] = []

export function AbaOcorrencias({
  o,
  permissao,
  somenteLeitura = false,
  onAbrir,
}: {
  o: Ordem
  /** Permissão de registrar/corrigir/cancelar (segue o módulo de origem). */
  permissao: string
  /** Lote de outro sistema (Gerenciamento de Projetos): nada se registra aqui. */
  somenteLeitura?: boolean
  /** Abre o painel: "nova" ou o id. */
  onAbrir: (ocorrencia: string) => void
}) {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const podeEditar = useCan(permissao) && !somenteLeitura
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const [cancelar, setCancelar] = useState<OcorrenciaLote | null>(null)
  const cancelamento = useCancelarOcorrencia(o.id)
  const salvar = useSalvarOcorrencia(o.id)
  const traducao = useTraducao()
  const autores = useMemo(
    () => [...new Set(o.ocorrencias.map((x) => x.criadoPor))].sort(),
    [o.ocorrencias],
  )

  const colunas = useMemo<DataTableColumn<OcorrenciaLote>[]>(
    () => [
      {
        id: 'numero',
        header: t('lotes.ocorrencias.cols.numero'),
        type: 'number',
        accessor: (r) => r.numero,
        size: 90,
        mobile: 'title',
        cell: (r) => <span className="font-mono">#{r.numero}</span>,
        exportValue: (r) => `#${r.numero}`,
      },
      {
        id: 'momento',
        header: t('lotes.ocorrencias.cols.momento'),
        type: 'enum',
        accessor: (r) => r.momento,
        size: 150,
        options: MOMENTOS.map((m) => ({ value: m, label: t(`lotes.ocorrencias.momentos.${m}`) })),
      },
      {
        id: 'categoria',
        header: t('lotes.ocorrencias.cols.categoria'),
        type: 'enum',
        accessor: (r) => r.categoria,
        size: 220,
        options: CATEGORIAS.map((c) => ({
          value: c,
          label: t(`lotes.ocorrencias.categorias.${c}`),
        })),
      },
      {
        id: 'texto',
        header: t('lotes.ocorrencias.cols.texto'),
        type: 'unique-text',
        accessor: (r) => textoEm(r.texto, idioma),
        size: 320,
        sortable: false,
        cell: (r) => <TextoTraduzido valor={r.texto} compacto className="max-w-full" />,
      },
      {
        id: 'fotos',
        header: t('lotes.ocorrencias.cols.fotos'),
        type: 'number',
        accessor: (r) => r.fotos.length,
        size: 120,
        cell: (r) =>
          r.fotos.length ? (
            <span className="inline-flex items-center gap-1 num">
              <Camera className="size-4 text-muted-foreground" aria-hidden />
              {formatNumber(r.fotos.length)}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        header: t('lotes.ocorrencias.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 140,
        mobile: 'badge',
        options: [
          { value: 'registrada', label: 'registrada' },
          { value: 'cancelado', label: 'cancelado' },
        ],
      },
      {
        id: 'criadoEm',
        header: t('lotes.ocorrencias.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.criadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.criadoEm),
      },
      {
        id: 'criadoPor',
        header: t('lotes.ocorrencias.cols.criadoPor'),
        type: 'enum',
        accessor: (r) => r.criadoPor,
        size: 160,
        options: autores.map((a) => ({ value: a, label: a })),
      },
    ],
    [t, idioma, autores],
  )

  return (
    <>
      <DataTable
        id="lote-ocorrencias"
        title={t('lotes.abas.ocorrencias')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={o.ocorrencias.length ? o.ocorrencias : SEM_OCORRENCIAS}
        query={query}
        onQueryChange={setQuery}
        exportName={`ocorrencias-${o.codigo}`}
        onCreate={podeEditar ? () => onAbrir('nova') : undefined}
        createLabel={t('lotes.ocorrencias.registrar')}
        onRowClick={(r) => r.status === 'registrada' && podeEditar && onAbrir(r.id)}
        renderExpanded={(r) => (
          <div className="flex flex-col gap-3 py-2">
            <TextoTraduzido
              valor={r.texto}
              onTraduzir={
                podeEditar && r.status === 'registrada'
                  ? async (v) => {
                      const texto = await traducao.completar(v)
                      await salvar
                        .mutateAsync({
                          ocorrenciaId: r.id,
                          dados: { momento: r.momento, categoria: r.categoria, texto },
                          fotos: [],
                        })
                        .catch(() => undefined)
                    }
                  : undefined
              }
            />
            {r.fotos.length > 0 && (
              <ul
                aria-label={t('lotes.ocorrencias.fotosDe', { numero: r.numero })}
                className="flex flex-wrap gap-2"
              >
                {r.fotos.map((f) => (
                  <li key={f.id}>
                    <FotoMiniatura
                      className="size-20"
                      src={urlFotoOcorrencia(o.id, r.id, f.id)}
                      titulo={f.nome}
                    />
                  </li>
                ))}
              </ul>
            )}
            {r.alteradoEm !== r.criadoEm && (
              <p className="type-caption text-muted-foreground">
                {t('lotes.ocorrencias.alteradoPor', {
                  nome: r.alteradoPor,
                  data: formatDateTime(r.alteradoEm),
                })}
              </p>
            )}
          </div>
        )}
        rowActions={(r) =>
          r.status === 'registrada' && podeEditar ? (
            <Can permission={permissao}>
              <>
                <DropdownMenuItem onSelect={() => onAbrir(r.id)}>
                  <Pencil aria-hidden />
                  {t('lotes.ocorrencias.corrigir')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setCancelar(r)}>
                  <Ban aria-hidden />
                  {t('lotes.ocorrencias.cancelar')}
                </DropdownMenuItem>
              </>
            </Can>
          ) : null
        }
        empty={{
          title: t('lotes.ocorrencias.vazioTitle'),
          description: t('lotes.ocorrencias.vazioBody'),
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelar)}
        onOpenChange={(aberto) => !aberto && setCancelar(null)}
        variant="destructive"
        title={t('lotes.ocorrencias.cancelarTitle', { numero: cancelar?.numero ?? '' })}
        description={t('lotes.ocorrencias.cancelarBody')}
        confirmLabel={t('lotes.ocorrencias.cancelar')}
        onConfirm={async () => {
          if (cancelar)
            await cancelamento.mutateAsync({ ocorrenciaId: cancelar.id, numero: cancelar.numero })
        }}
      />
    </>
  )
}
