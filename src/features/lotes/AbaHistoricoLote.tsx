import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { formatDate } from '@/lib/format'
import type {
  CategoriaOcorrencia,
  MomentoOcorrencia,
  Mudanca,
  Ordem,
  TipoDocumentoLote,
} from '@/services/types'

/* Histórico do lote (auditoria em tabela, como o do cliente): agendamento, edições, ocorrências e
 * documentos. */

const ACOES = [
  'criado',
  'editado',
  'status',
  'ocorrencia_registrada',
  'ocorrencia_editada',
  'ocorrencia_cancelada',
  'documento_adicionado',
  'documento_removido',
] as const

/** Campos das ocorrências e dos documentos (rótulos do lote). */
const CAMPOS_LOTE = ['status', 'momento', 'categoria', 'texto', 'fotos', 'tipoDocumento'] as const

/** Campos da edição do lote (mesmos rótulos do Agendamento). */
const CAMPOS_AGENDAMENTO = [
  'site',
  'doca',
  'transportadora',
  'referenciaCliente',
  'dataColeta',
  'coletaPrevista',
  'dataChegada',
  'rastrear',
  'motorista',
  'placa',
  'boxes',
  'pallets',
  'gaylords',
  'racks',
  'placasPolicarbonato',
  'requerPalletsVazios',
  'palletsVazios',
  'itensMais25kg',
  'fatorLimitante',
  'escopo',
  'observacoes',
] as const

const DATAS = new Set(['dataColeta', 'coletaPrevista', 'dataChegada'])

export function AbaHistoricoLote({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const acoes = useMemo(
    () => Object.fromEntries(ACOES.map((a) => [a, t(`lotes.historico.acoes.${a}`)])),
    [t],
  )
  const campos = useMemo(
    () => ({
      ...Object.fromEntries(CAMPOS_LOTE.map((k) => [k, t(`lotes.historico.campos.${k}`)])),
      ...Object.fromEntries(
        CAMPOS_AGENDAMENTO.map((k) => [k, t(`ordens.agendamento.campos.${k}`)]),
      ),
      servicos: t('ordens.agendamento.secoes.servicos'),
      caminhao: t('ordens.agendamento.calculo.caminhao'),
      viagens: t('ordens.agendamento.calculo.viagens'),
      pessoas: t('ordens.agendamento.calculo.pessoas'),
    }),
    [t],
  )
  const formatar = useCallback(
    (campo: string, v: Mudanca['antes']) => {
      if (campo === 'momento') return t(`lotes.ocorrencias.momentos.${v as MomentoOcorrencia}`)
      if (campo === 'categoria')
        return t(`lotes.ocorrencias.categorias.${v as CategoriaOcorrencia}`)
      if (campo === 'tipoDocumento') return t(`lotes.documentos.tipos.${v as TipoDocumentoLote}`)
      if (campo === 'caminhao')
        return t(`veiculos.tipos.${v as 'van'}`, { defaultValue: String(v) })
      if (DATAS.has(campo)) return formatDate(String(v))
      return undefined
    },
    [t],
  )
  return (
    <HistoricoTabela
      id="lote-historico"
      titulo={t('lotes.abas.historico')}
      historico={o.historico}
      exportName={`historico-${o.codigo}`}
      acoes={acoes}
      campos={campos}
      formatar={formatar}
    />
  )
}
