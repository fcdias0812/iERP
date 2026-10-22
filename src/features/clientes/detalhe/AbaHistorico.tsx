import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import type { Cliente, Mudanca, TipoDocumento } from '@/services/types'
import { NOME_SISTEMA } from '../configuracoes'

/* Histórico do cliente (auditoria em tabela): dados, contatos, sites, documentos e configurações. */

const ACOES = [
  'criado',
  'editado',
  'status',
  'site_criado',
  'site_editado',
  'site_removido',
  'documento_adicionado',
  'documento_removido',
  'configurado',
  'rastreio_gerado',
  'rastreio_trocado',
  'rastreio_desativado',
] as const

const CAMPOS = [
  'nome',
  'cnpj',
  'slaDias',
  'contatos',
  'status',
  'codigo',
  'regiao',
  'horario',
  'totalGaylords',
  'cep',
  'endereco',
  'latitude',
  'longitude',
  'shredderProprio',
  'edgeSite',
  'responsavel',
  'contatoNovo',
  'docas',
  'tipoDocumento',
  // Aba Configurações.
  'rastrearColeta',
  'rastreioExcecao',
  'exigirMotoristaPlaca',
  'servicosPadrao',
  'transportadoraPadrao',
  'instrucoes',
  'exigirEscopoPlanilha',
  'exigirLacre',
  'exigirNota',
  'exigirTara',
  'exigirFotosGerais',
  'sistemaProcessamento',
  'diasParadoEtapa',
  'antecedenciaDias',
  'agendamentoBloqueado',
  'bloqueioMotivo',
] as const

export function AbaHistorico({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const acoes = useMemo(
    () => Object.fromEntries(ACOES.map((a) => [a, t(`clientes.history.${a}`)])),
    [t],
  )
  const campos = useMemo(
    () => Object.fromEntries(CAMPOS.map((k) => [k, t(`clientes.historico.campos.${k}`)])),
    [t],
  )
  const formatar = useCallback(
    (campo: string, v: Mudanca['antes']) => {
      if (campo === 'cep') return String(v).replace(/^(\d{5})(\d{3})$/, '$1-$2')
      if (campo === 'regiao')
        return t(`clientes.sites.regioes.${v as 'sul'}`, { defaultValue: String(v) })
      if (campo === 'tipoDocumento') return t(`clientes.documentos.tipos.${v as TipoDocumento}`)
      if (campo === 'sistemaProcessamento') return NOME_SISTEMA[String(v)] ?? String(v)
      return undefined
    },
    [t],
  )
  return (
    <HistoricoTabela
      id="cliente-historico"
      titulo={t('clientes.tabs.historico')}
      historico={c.historico}
      exportName={`historico-${c.codigo}`}
      acoes={acoes}
      campos={campos}
      formatar={formatar}
    />
  )
}
