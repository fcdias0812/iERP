import { Router } from 'express'
import type { ServicoGeo } from './geo.servico.js'

/*
 * Geolocalização (montada em /api/geo):
 *   GET /cep/:cep          endereço do CEP (ViaCEP)
 *   GET /endereco?q=       latitude/longitude do endereço (Nominatim, 1 consulta/s, com cache)
 */
export function rotasGeo(servico: ServicoGeo) {
  const r = Router()

  r.get('/cep/:cep', async (req, res) => {
    res.json(await servico.porCep(req.params.cep))
  })

  r.get('/endereco', async (req, res) => {
    res.json(await servico.porEndereco(typeof req.query.q === 'string' ? req.query.q : ''))
  })

  return r
}
