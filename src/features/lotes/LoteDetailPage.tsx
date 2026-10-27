import { useEffect } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ClipboardPen,
  FileText,
  History,
  Info,
  ListChecks,
  MessageSquareWarning,
  PackageCheck,
  Pencil,
} from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { DetailPage } from '@/components/patterns/DetailPage'
import { Button } from '@/components/ui/button'
import { AuditInfo, CopyableId } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { useLote } from '@/features/ordens/use-ordens'
import { AppError, NotFoundContent } from '@/features/system/ErrorPages'
import { ApiError } from '@/services/http'
import type { Ordem } from '@/services/types'
import { useBreadcrumb } from '@/stores/breadcrumb-store'
import { AbaDocumentosLote } from './AbaDocumentosLote'
import { AbaHistoricoLote } from './AbaHistoricoLote'
import { AbaInformacoes } from './AbaInformacoes'
import { AbaOcorrencias } from './AbaOcorrencias'
import { AbaProgresso } from './AbaProgresso'
import { LoteSheet } from './LoteSheet'
import { RecebimentoSheet } from './RecebimentoSheet'
import type { LoteSearch } from './lote-search'
import { OcorrenciaSheet } from './OcorrenciaSheet'
import type { AbaLote, OrigemLote } from './origem'
import { AvisoLoteDeFora, DocumentosDeFora } from './LoteDeFora'
import { AvisoDevolucao } from './ProcessamentoExterno'
import { StatusDoLote } from './StatusDoLote'
import { DocumentosGerados } from './DocumentosGerados'
import { AbrirNoSistema } from './LotesJuntados'

/**
 * Detalhe do lote (padrão Detalhe), aberto de Ordens › Lotes ou de Operação › Lotes: abas
 * Informações, Progresso, Ocorrências, Documentos e Histórico. A permissão segue o módulo de origem.
 * Lote do Gerenciamento de Projetos é só para ver (`LoteDeFora.tsx`).
 */
export function LoteDetailPage({ origem }: { origem: OrigemLote }) {
  const { id } = useParams({ strict: false }) as { id: string }
  return (
    <RequirePermission permission={`${origem}.lotes.ver`}>
      <LoteDetail id={id} origem={origem} />
    </RequirePermission>
  )
}

/** Navega dentro do detalhe (aba, painel da ocorrência), na rota do módulo de origem. */
function useIrNoLote(origem: OrigemLote, id: string) {
  const navigate = useNavigate()
  return (search: LoteSearch, replace = false) =>
    void (origem === 'ordens'
      ? navigate({ to: '/ordens/lotes/$id', params: { id }, search, replace })
      : navigate({ to: '/operacao/lotes/$id', params: { id }, search, replace }))
}

function LoteDetail({ id, origem }: { id: string; origem: OrigemLote }) {
  const query = useLote(id)
  const o = query.data
  useBreadcrumb(o ? { parent: `/${origem}/lotes`, label: o.codigo } : null)

  if (query.isPending)
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  if (query.error instanceof ApiError && query.error.isNotFound) return <NotFoundContent />
  if (query.isError || !o)
    return <AppError error={query.error} reset={() => void query.refetch()} />
  // Juntado a outro da mesma coleta: abre o principal (22/10/2026).
  if (o.juntadoA) return <IrParaPrincipal origem={origem} id={o.juntadoA.id} />
  return <Detalhe o={o} origem={origem} />
}

function IrParaPrincipal({ origem, id }: { origem: OrigemLote; id: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({
      to: origem === 'ordens' ? '/ordens/lotes/$id' : '/operacao/lotes/$id',
      params: { id },
      replace: true,
    })
  }, [navigate, origem, id])
  return <Skeleton className="h-64 w-full" />
}

function Detalhe({ o, origem }: { o: Ordem; origem: OrigemLote }) {
  const { t } = useTranslation()
  const {
    aba = 'informacoes',
    ocorrencia,
    editar,
    receber,
  } = useSearch({ strict: false }) as LoteSearch
  const ir = useIrNoLote(origem, o.id)
  const permissaoEditar = `${origem}.lotes.editar`
  const abaUrl = (a: AbaLote) => (a === 'informacoes' ? undefined : a)
  const abrirOcorrencia = (oc: string) => ir({ aba: 'ocorrencias', ocorrencia: oc })
  const ativas = o.ocorrencias.filter((x) => x.status === 'registrada').length
  // Lote do Gerenciamento de Projetos: só para ver aqui — nada muda pela tela (é alterado lá).
  const deFora = Boolean(o.externo)
  // Decisão do usuário: os dados do agendamento só mudam enquanto o lote está agendado.
  const editavel = !deFora && o.status === 'agendado'
  // Recebimento (Operação): receber o agendado; corrigir enquanto em Inspeção.
  const podeReceber = !deFora && o.status === 'agendado'
  // Com devolução pedida pelo sistema de fora (MoonShot), a correção vale em qualquer etapa.
  const podeCorrigirRecebimento =
    !deFora && (o.status === 'inspecao' || Boolean(o.devolucao)) && Boolean(o.recebimento)

  return (
    <>
      <DetailPage
        title={o.codigo}
        description={t('lotes.detalhe.descricao', {
          cliente: o.clienteNome,
          site: o.siteCodigo,
          doca: o.docaNumero,
        })}
        status={<StatusDoLote lote={o} />}
        alerts={
          deFora ? <AvisoLoteDeFora o={o} /> : o.devolucao ? <AvisoDevolucao o={o} /> : undefined
        }
        tab={aba}
        onTabChange={(nova) => ir({ aba: abaUrl(nova as AbaLote) }, true)}
        meta={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <CopyableId value={o.codigo} />
            <AuditInfo
              createdBy={o.criadoPor}
              createdAt={o.criadoEm}
              updatedBy={o.alteradoPor}
              updatedAt={o.alteradoEm}
              className="sm:flex-row sm:gap-3"
            />
          </div>
        }
        actions={
          <>
            <AbrirNoSistema o={o} />
            <DocumentosGerados o={o} />
            {editavel && (
              <Can permission={permissaoEditar} fallback="disable">
                <Button variant="secondary" onClick={() => ir({ aba: abaUrl(aba), editar: true })}>
                  <Pencil aria-hidden />
                  {t('lotes.editar.botao')}
                </Button>
              </Can>
            )}
            {podeCorrigirRecebimento && (
              <Can permission="operacao.recebimento.editar" fallback="disable">
                <Button variant="secondary" onClick={() => ir({ aba: abaUrl(aba), receber: true })}>
                  <ClipboardPen aria-hidden />
                  {t('recebimento.corrigir')}
                </Button>
              </Can>
            )}
            {!deFora && (
              <Can permission={permissaoEditar} fallback="disable">
                <Button
                  variant={podeReceber ? 'secondary' : 'default'}
                  onClick={() => abrirOcorrencia('nova')}
                >
                  <MessageSquareWarning aria-hidden />
                  {t('lotes.ocorrencias.registrar')}
                </Button>
              </Can>
            )}
            {podeReceber && (
              <Can permission="operacao.recebimento.editar" fallback="disable">
                <Button onClick={() => ir({ aba: abaUrl(aba), receber: true })}>
                  <PackageCheck aria-hidden />
                  {t('recebimento.receberLote')}
                </Button>
              </Can>
            )}
          </>
        }
        tabs={[
          {
            id: 'informacoes',
            label: t('lotes.abas.informacoes'),
            icon: Info,
            content: <AbaInformacoes o={o} />,
          },
          {
            id: 'progresso',
            label: t('lotes.abas.progresso'),
            icon: ListChecks,
            content: <AbaProgresso o={o} />,
          },
          {
            id: 'ocorrencias',
            label: t('lotes.abas.ocorrencias'),
            icon: MessageSquareWarning,
            count: ativas,
            content: (
              <AbaOcorrencias
                o={o}
                permissao={permissaoEditar}
                somenteLeitura={deFora}
                onAbrir={abrirOcorrencia}
              />
            ),
          },
          {
            id: 'documentos',
            label: t('lotes.abas.documentos'),
            icon: FileText,
            count: deFora ? undefined : o.anexos.length,
            content: deFora ? (
              <DocumentosDeFora o={o} />
            ) : (
              <AbaDocumentosLote
                o={o}
                permissao={permissaoEditar}
                permissaoExcluir={`${origem}.lotes.excluir`}
              />
            ),
          },
          {
            id: 'historico',
            label: t('lotes.abas.historico'),
            icon: History,
            content: <AbaHistoricoLote o={o} />,
          },
        ]}
      />

      {receber && (podeReceber || podeCorrigirRecebimento) && (
        <RecebimentoSheet
          loteId={o.id}
          permissao="operacao.recebimento.editar"
          onClose={() => ir({ aba: abaUrl(aba) })}
        />
      )}

      {editar && editavel && (
        <LoteSheet lote={o} permissao={permissaoEditar} onClose={() => ir({ aba: abaUrl(aba) })} />
      )}

      {ocorrencia && !(deFora && ocorrencia === 'nova') && (
        <OcorrenciaSheet
          key={ocorrencia}
          lote={o}
          ocorrenciaId={ocorrencia === 'nova' ? null : ocorrencia}
          permissao={permissaoEditar}
          onClose={() => ir({ aba: abaUrl(aba) })}
        />
      )}
    </>
  )
}
