import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, formatNumber } from '@/lib/format'
import type {
  CategoriaOcorrencia,
  MomentoOcorrencia,
  Mudanca,
  TipoDocumentoLote,
} from '@/services/types'

/*
 * Rótulos do histórico do lote — usados na aba Histórico do lote e nos históricos de módulo
 * (Ordens › Histórico, Operação › Histórico).
 */

/** Todas as ações do histórico do lote. */
export const ACOES_LOTE = [
  'criado',
  'editado',
  'status',
  'ocorrencia_registrada',
  'ocorrencia_editada',
  'ocorrencia_cancelada',
  'documento_adicionado',
  'documento_removido',
  'recebido',
  'recebimento_editado',
] as const

/** Campos das ocorrências e dos documentos (rótulos do lote). */
const CAMPOS_LOTE = [
  'status',
  'momento',
  'categoria',
  'texto',
  'fotos',
  'tipoDocumento',
  'dataRecebimento',
  'inspecao',
  'inspecaoDescricao',
  'lacres',
  'notas',
  'palletsRecebidos',
  'pesoBruto',
  'pesoLiquido',
  'fotosGerais',
] as const

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

const DATAS = new Set(['dataColeta', 'coletaPrevista', 'dataChegada', 'dataRecebimento'])
const PESOS = new Set(['pesoBruto', 'pesoLiquido'])

/** Rótulos de ações e campos do histórico do lote, e a formatação dos valores. */
export function useRotulosHistoricoLote() {
  const { t } = useTranslation()
  const acoes = useMemo(
    () => Object.fromEntries(ACOES_LOTE.map((a) => [a, t(`lotes.historico.acoes.${a}`)])),
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
      if (PESOS.has(campo)) return `${formatNumber(Number(v))} kg`
      if (campo === 'inspecao') return t(`status.inspecao_${v as 'bom'}`)
      return undefined
    },
    [t],
  )
  return { acoes, campos, formatar }
}
