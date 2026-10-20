import { useCallback, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HistoricoTabela, type RegistroDaLinha } from '@/features/comum/HistoricoTabela'
import { SeletorPeriodo } from '@/features/historico/SeletorPeriodo'
import { desdeDo, type Periodo } from '@/features/historico/periodo'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatNumber } from '@/lib/format'
import { estoqueKeys, listarHistoricoEstoque } from '@/services/estoque'
import type {
  AbaEstoque,
  EventoAuditoria,
  EventoEstoque,
  EventoHistorico,
  Mudanca,
} from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { STATUS_MAQUINA } from './tons'

/*
 * Estoque › Histórico (pedido do usuário, 20/10/2026: "igual as outras de histórico"): a mesma
 * tabela de auditoria dos outros históricos, com o que mudou no estoque dos três sistemas — o
 * iERP compara as leituras (entrou, saiu, mudou). Colunas: quando, tela do estoque, item (link
 * para a tela já buscada por ele), sistema, ação, campo, antes e depois.
 */

const SEM_EVENTOS: EventoEstoque[] = []
const ABAS: AbaEstoque[] = ['materiais', 'assets', 'pecas', 'ecommerce']
const CAMPOS = [
  'statusFisico',
  'statusVenda',
  'quantidade',
  'pesoKg',
  'area',
  'posicao',
  'statusMaquina',
  'preparo',
  'grade',
  'loteDeLa',
  'produtoAtivo',
] as const

export function HistoricoEstoquePage() {
  return (
    <RequirePermission permission="estoque.historico.ver">
      <Historico />
    </RequirePermission>
  )
}

function Historico() {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const [periodo, setPeriodo] = useState<Periodo>('90')
  const desde = useMemo(() => desdeDo(periodo), [periodo])
  const consulta = useQuery({
    queryKey: estoqueKeys.historico(desde),
    queryFn: ({ signal }) => listarHistoricoEstoque(desde, signal),
  })

  const acoes = useMemo(
    () => ({
      entrada: t('estoque.historico.acoes.entrada'),
      saida: t('estoque.historico.acoes.saida'),
      alterado: t('estoque.historico.acoes.alterado'),
    }),
    [t],
  )
  const campos = useMemo(
    () => Object.fromEntries(CAMPOS.map((c) => [c, t(`estoque.historico.campos.${c}`)])),
    [t],
  )
  const registro = useMemo(
    () => ({
      titulo: t('estoque.historico.item'),
      tipos: Object.fromEntries(ABAS.map((a) => [a, t(`nav.estoque.${a}`)])),
      link: ({ rotulo, tipo }: RegistroDaLinha) => {
        // A tela do estoque já buscada pelo item (E-commerce: pelo SKU, sem a posição).
        const busca = tipo === 'ecommerce' ? rotulo.split(' @ ')[0]! : rotulo
        return (
          <Link
            to={`/estoque/${(tipo ?? 'materiais') as AbaEstoque}`}
            search={{ q: busca }}
            className="font-mono text-link underline-offset-4 hover:underline"
          >
            {rotulo}
          </Link>
        )
      },
    }),
    [t],
  )
  const formatar = useCallback(
    (campo: string, v: Mudanca['antes'], e: EventoHistorico | EventoAuditoria) => {
      if (v === null) return undefined
      if (campo === 'statusFisico' || campo === 'statusVenda') {
        const r = (e as unknown as EventoEstoque).rotulos?.[String(v)]
        if (!r) return String(v)
        return idioma === 'en' ? (r.en ?? r.pt) : idioma === 'zh-TW' ? (r.zh ?? r.pt) : r.pt
      }
      if (campo === 'statusMaquina')
        return STATUS_MAQUINA.includes(Number(v)) ? t(`estoque.statusMaquina.${v as 1}`) : String(v)
      if (campo === 'preparo')
        return [1, 2, 3, 4].includes(Number(v)) ? t(`estoque.preparo.${v as 1}`) : String(v)
      if (campo === 'quantidade') return formatNumber(Number(v))
      if (campo === 'pesoKg') return `${formatNumber(Number(v))} kg`
      return undefined
    },
    [t, idioma],
  )

  return (
    <ListPage title={t('nav.estoque.historico')} description={t('estoque.historico.descricao')}>
      <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
      {consulta.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : consulta.isError ? (
        <Alert
          tone="danger"
          title={t('estoque.historico.erro')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void consulta.refetch()}>
              {t('common.tryAgain')}
            </Button>
          }
        >
          {apiErrorMessage(consulta.error)}
        </Alert>
      ) : (
        <HistoricoTabela
          id="historico-estoque"
          titulo={t('nav.estoque.historico')}
          // O mesmo formato da auditoria (tipo = a tela do estoque; autor = o sistema de lá).
          historico={(consulta.data ?? SEM_EVENTOS) as unknown as EventoAuditoria[]}
          exportName="historico-estoque"
          acoes={acoes}
          campos={campos}
          formatar={formatar}
          registro={registro}
        />
      )}
    </ListPage>
  )
}
