/*
 * Configuração do mapa do dashboard (arquivo leve: a página importa daqui sem puxar o
 * Leaflet, que só carrega com o mapa).
 */

export type FundoMapa = 'limpo' | 'cinza' | 'satelite'

/** Chave da Esri (ArcGIS Location Platform) para o fundo Satélite. Sem ela, o botão some. */
export const CHAVE_ESRI = import.meta.env.VITE_ESRI_API_KEY as string | undefined
export const TEM_SATELITE = Boolean(CHAVE_ESRI)
