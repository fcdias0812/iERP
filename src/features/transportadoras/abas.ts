/*
 * Abas do detalhe da transportadora (`?aba=` na URL). Arquivo leve de propósito: a rota importa
 * daqui para validar a URL.
 */
export const ABAS_TRANSPORTADORA = ['dados', 'contatos', 'motoristas', 'historico'] as const
export type AbaTransportadora = (typeof ABAS_TRANSPORTADORA)[number]
