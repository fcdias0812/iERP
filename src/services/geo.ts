import { api } from './http'
import type { Coordenadas, EnderecoCep } from './types'

/*
 * Localização para o cadastro de sites (pelo servidor, que respeita os limites de uso dos
 * serviços públicos): CEP → endereço (ViaCEP) e endereço → latitude/longitude (OpenStreetMap).
 * Chamar só por ação da pessoa (botão), nunca enquanto digita.
 */
export const buscarCep = (cep: string) =>
  api<EnderecoCep>(`/geo/cep/${encodeURIComponent(cep.replace(/\D/g, ''))}`)

export const localizarEndereco = (endereco: string) =>
  api<Coordenadas>('/geo/endereco', { query: { q: endereco } })
