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
    | 'documento_adicionado'
    | 'documento_removido'
    | 'ocorrencia_registrada'
    | 'ocorrencia_editada'
    | 'ocorrencia_cancelada'
    | 'recebido'
    | 'recebimento_editado'
  mudancas?: Mudanca[]
  nota?: string
}
