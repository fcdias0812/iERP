import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { DataTable, useUrlTableQuery, type DataTableColumn } from '@/components/data-table'
import type { SortItem, TableQuery } from '@/components/data-table/types'
import { AppLink } from '@/components/layout/AppLink'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatNumber, formatTime } from '@/lib/format'
import { estoqueKeys, listarEstoque, type LinhasPorAba } from '@/services/estoque'
import type { AbaEstoque } from '@/services/types'

/*
 * A moldura das telas do Estoque que vêm de fora (pedido do usuário, 20/10/2026): Materiais
 * (armazém), Assets e Peças (Controle de Notebooks) e E-commerce (RTB WMS). Só para ver: a lista
 * de lá, lida ao vivo pelo servidor (guardada 1 minuto), com "Atualizar", "Abrir no sistema" e o
 * aviso quando o sistema não está cadastrado ou não respondeu — a tela nunca fica em branco sem
 * dizer por quê.
 */

const VAZIA: never[] = []

export function EstoqueDeFora<A extends AbaEstoque>({
  aba,
  montarColunas,
  ordem,
  linkDaLinha,
}: {
  aba: A
  /** As colunas, montadas com as linhas que vieram (os filtros oferecem os valores de lá). */
  montarColunas: (linhas: LinhasPorAba[A][]) => DataTableColumn<LinhasPorAba[A]>[]
  /** Ordem inicial (sem ela a tabela desempata pelo id e parece aleatória). */
  ordem: SortItem[]
  /** Link de "abrir no sistema" de UMA linha (padrão: a tela geral do sistema). */
  linkDaLinha?: (linha: LinhasPorAba[A]) => string | null
}) {
  return (
    <RequirePermission permission={`estoque.${aba}.ver`}>
      <Lista aba={aba} montarColunas={montarColunas} ordem={ordem} linkDaLinha={linkDaLinha} />
    </RequirePermission>
  )
}

function Lista<A extends AbaEstoque>({
  aba,
  montarColunas,
  ordem,
  linkDaLinha,
}: {
  aba: A
  /** As colunas, montadas com as linhas que vieram (os filtros oferecem os valores de lá). */
  montarColunas: (linhas: LinhasPorAba[A][]) => DataTableColumn<LinhasPorAba[A]>[]
  ordem: SortItem[]
  linkDaLinha?: (linha: LinhasPorAba[A]) => string | null
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: estoqueKeys.aba(aba),
    queryFn: ({ signal }) => listarEstoque(aba, false, signal),
  })
  const atualizar = useMutation({
    mutationFn: () => listarEstoque(aba, true),
    onSuccess: (d) => qc.setQueryData(estoqueKeys.aba(aba), d),
    onError: (e) => toast.error(t('estoque.atualizarFalhou'), { description: apiErrorMessage(e) }),
  })
  const d = q.data
  const linhas = d?.linhas ?? (VAZIA as LinhasPorAba[A][])
  const colunas = useMemo(() => montarColunas(linhas), [montarColunas, linhas])
  // Filtros e ordem na URL: voltar (ou reabrir o link) mantém a busca.
  const [query, setQuery] = useUrlTableQuery(colunas)
  const consulta = useMemo<TableQuery>(
    () => (query.sort.length ? query : { ...query, sort: ordem }),
    [query, ordem],
  )
  const sistema = d?.nome ?? t(`estoque.sistemas.${sistemaDaAba(aba)}`)
  const abrir = (l: LinhasPorAba[A]) => linkDaLinha?.(l) ?? d?.urlSistema ?? null
  const rowActions = useMemo(
    () =>
      d?.urlSistema
        ? (l: LinhasPorAba[A]) => {
            const href = abrir(l)
            return href ? (
              <DropdownMenuItem asChild>
                <a href={href} target="_blank" rel="noreferrer noopener">
                  <ExternalLink aria-hidden />
                  {t('estoque.abrirNo', { sistema })}
                </a>
              </DropdownMenuItem>
            ) : null
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `abrir` depende só destes
    [d?.urlSistema, linkDaLinha, sistema, t],
  )

  return (
    <ListPage
      title={t(`nav.estoque.${aba}`)}
      description={
        d && !d.indisponivel
          ? t('estoque.lidoAs', { sistema, hora: formatTime(d.lidoEm) })
          : t(`estoque.descricoes.${aba}`)
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => atualizar.mutate()}
            loading={atualizar.isPending}
            disabled={!d?.configurado}
          >
            {!atualizar.isPending && <RefreshCw aria-hidden />}
            {t('estoque.atualizar')}
          </Button>
          {d?.urlSistema && (
            <Button variant="secondary" asChild>
              <a href={d.urlSistema} target="_blank" rel="noreferrer noopener">
                <ExternalLink aria-hidden />
                {t('estoque.abrirNo', { sistema })}
              </a>
            </Button>
          )}
        </div>
      }
    >
      {q.isError && !d && (
        <Alert tone="danger" title={t('apiErrors.server')}>
          {apiErrorMessage(q.error)}
        </Alert>
      )}
      {d && !d.configurado && (
        <Alert
          tone="info"
          title={t('estoque.naoConfigurado.titulo', { sistema })}
          action={
            <Button size="sm" variant="secondary" asChild>
              <AppLink to="/admin/integracao">{t('estoque.naoConfigurado.acao')}</AppLink>
            </Button>
          }
        >
          {t('estoque.naoConfigurado.texto', { sistema })}
        </Alert>
      )}
      {d?.configurado && d.indisponivel && d.motivo && (
        <Alert tone="warning" title={t(`estoque.motivos.${d.motivo}`, { sistema })}>
          {d.detalhe ? t('estoque.detalhe', { detalhe: d.detalhe }) : undefined}
        </Alert>
      )}
      {d?.incompleto && (
        <Alert
          tone="info"
          title={
            d.total === null
              ? t('estoque.incompletoSemTotal', { n: formatNumber(d.linhas.length), sistema })
              : t('estoque.incompleto', {
                  n: formatNumber(d.linhas.length),
                  total: formatNumber(d.total),
                  sistema,
                })
          }
        />
      )}
      <DataTable
        id={`estoque-${aba}`}
        title={t(`nav.estoque.${aba}`)}
        exportName={`estoque-${aba}`}
        columns={colunas}
        getRowId={(l) => l.id}
        data={linhas}
        query={consulta}
        onQueryChange={setQuery}
        loading={q.isPending}
        rowActions={rowActions}
        empty={{ title: t(`estoque.vazio.${aba}`) }}
      />
    </ListPage>
  )
}

const sistemaDaAba = (aba: AbaEstoque) =>
  aba === 'materiais' ? 'ARMAZEM' : aba === 'ecommerce' ? 'RTB_WMS' : 'NOTEBOOKS'
