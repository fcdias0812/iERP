/* Histórico de alterações dos registros (mesmo formato em todos os módulos). */

export interface Mudanca {
  /** Chave do campo (a tela traduz). */
  campo: string
  antes: string | number | boolean | null
  depois: string | number | boolean | null
}

export interface EventoHistorico {
  id: string
  autor: string
  em: string
  acao:
    | 'criado'
    | 'editado'
    | 'status'
    | 'site_criado'
    | 'site_editado'
    | 'site_removido'
    | 'configurado'
    | 'documento_adicionado'
    | 'documento_removido'
    | 'ocorrencia_registrada'
    | 'ocorrencia_editada'
    | 'ocorrencia_cancelada'
    | 'recebido'
    | 'recebimento_editado'
    | 'processamento'
    | 'devolucao_pedida'
    | 'devolucao_cancelada'
    | 'chave_gerada'
    | 'chave_trocada'
    | 'chave_revogada'
    | 'viagem_iniciada'
    | 'viagem_chegou'
    | 'viagem_finalizada'
    | 'viagem_cancelada'
    | 'viagem_emergencia'
    | 'viagem_emergencia_ciente'
  mudancas?: Mudanca[]
  nota?: string
}
