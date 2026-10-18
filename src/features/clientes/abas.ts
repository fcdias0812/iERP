/*
 * Abas do detalhe do cliente (`?aba=` na URL). Arquivo leve de propósito: a rota importa daqui
 * para validar a URL, e o que a rota usa fora do componente vai para o pacote principal.
 */
export const ABAS_CLIENTE = [
  'visao-geral',
  'contatos',
  'logistica',
  'documentos',
  'configuracoes',
  'historico',
] as const
export type AbaCliente = (typeof ABAS_CLIENTE)[number]
