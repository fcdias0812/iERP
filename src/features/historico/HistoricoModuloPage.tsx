import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useRotulosHistoricoLote } from '@/features/lotes/historico-lote'
import { apiErrorMessage } from '@/lib/api-errors'
import { historicoKeys, listarHistoricoModulo } from '@/services/historico'
import type { EventoHistoricoModulo, ModuloHistorico } from '@/services/types'

/*
 * Histórico do MÓDULO (Ordens › Histórico e Operação › Histórico — pedido do usuário): a mesma
 * auditoria em tabela dos registros, de todos os lotes do módulo, com a coluna do lote (abre o
 * lote no próprio módulo) e do cliente. O servidor já filtra o que é de cada módulo.
 * Período carregado: 30 dias, 90 dias (padrão), 12 meses ou tudo — mantém a tela leve.
 */

const PERIODOS = ['30', '90', '365', 'tudo'] as const
type Periodo = (typeof PERIODOS)[number]

/** Ações que aparecem em cada módulo (as mesmas do servidor). */
const ACOES_DO_MODULO: Record<ModuloHistorico, string[]> = {
  ordens: [
    'criado',
    'editado',
    'documento_adicionado',
    'documento_removido',
    'ocorrencia_registrada',
    'ocorrencia_editada',
    'ocorrencia_cancelada',
  ],
  operacao: [
    'criado',
    'recebido',
    'recebimento_editado',
    'status',
    'ocorrencia_registrada',
    'ocorrencia_editada',
    'ocorrencia_cancelada',
  ],
}

const SEM_EVENTOS: EventoHistoricoModulo[] = []

/** Início do período (ISO), contado a partir de agora. */
function desdeDo(periodo: Periodo): string | null {
  if (periodo === 'tudo') return null
  const d = new Date()
  d.setDate(d.getDate() - Number(periodo))
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function HistoricoModuloPage({ modulo }: { modulo: ModuloHistorico }) {
  return (
    <RequirePermission permission={`${modulo}.ver`}>
      <Historico modulo={modulo} />
    </RequirePermission>
  )
}

function Historico({ modulo }: { modulo: ModuloHistorico }) {
  const { t } = useTranslation()
  const [periodo, setPeriodo] = useState<Periodo>('90')
  const periodoId = useId()
  // O início do período é fixado ao escolher (não muda a cada render).
  const desde = useMemo(() => desdeDo(periodo), [periodo])
  const consulta = useQuery({
    queryKey: historicoKeys.modulo(modulo, desde),
    queryFn: ({ signal }) => listarHistoricoModulo(modulo, desde, signal),
  })
  const rotulos = useRotulosHistoricoLote()
  const acoes = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(rotulos.acoes).filter(([a]) => ACOES_DO_MODULO[modulo].includes(a)),
      ),
    [rotulos.acoes, modulo],
  )
  const registro = useMemo(
    () => ({
      titulo: t('historico.cols.lote'),
      link: (id: string, codigo: string) =>
        modulo === 'ordens' ? (
          <Link
            to="/ordens/lotes/$id"
            params={{ id }}
            search={{ aba: 'historico' }}
            className="font-mono text-link underline-offset-4 hover:underline"
          >
            {codigo}
          </Link>
        ) : (
          <Link
            to="/operacao/lotes/$id"
            params={{ id }}
            search={{ aba: 'historico' }}
            className="font-mono text-link underline-offset-4 hover:underline"
          >
            {codigo}
          </Link>
        ),
    }),
    [t, modulo],
  )

  return (
    <ListPage title={t(`nav.${modulo}.historico`)} description={t(`historicoModulo.${modulo}`)}>
      {/* Celular: lista de escolha (os 4 botões não cabem lado a lado). */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        <Label htmlFor={periodoId}>{t('historicoModulo.periodo')}</Label>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger id={periodoId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`historicoModulo.periodos.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ButtonGroup aria-label={t('historicoModulo.periodo')} className="hidden sm:inline-flex">
        {PERIODOS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={periodo === p ? 'default' : 'secondary'}
            aria-pressed={periodo === p}
            onClick={() => setPeriodo(p)}
          >
            {t(`historicoModulo.periodos.${p}`)}
          </Button>
        ))}
      </ButtonGroup>
      {consulta.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : consulta.isError ? (
        <Alert
          tone="danger"
          title={t('historicoModulo.erro')}
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
          id={`historico-${modulo}`}
          titulo={t(`nav.${modulo}.historico`)}
          historico={consulta.data ?? SEM_EVENTOS}
          exportName={`historico-${modulo}`}
          acoes={acoes}
          campos={rotulos.campos}
          formatar={rotulos.formatar}
          registro={registro}
        />
      )}
    </ListPage>
  )
}
