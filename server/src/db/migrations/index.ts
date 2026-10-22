import type { Migration } from 'kysely/migration'
import * as m20261018_01 from './2026-10-18-01-usuarios.js'
import * as m20261018_02 from './2026-10-18-02-clientes.js'
import * as m20261018_03 from './2026-10-18-03-clientes-logistica-documentos.js'
import * as m20261019_01 from './2026-10-19-01-transportadoras-motoristas-veiculos.js'
import * as m20261019_02 from './2026-10-19-02-ordens.js'
import * as m20261019_03 from './2026-10-19-03-sla-e-etapas-do-lote.js'
import * as m20261019_04 from './2026-10-19-04-detalhe-do-lote.js'
import * as m20261019_05 from './2026-10-19-05-tipo-dos-documentos-do-lote.js'
import * as m20261019_06 from './2026-10-19-06-recebimento.js'
import * as m20261019_07 from './2026-10-19-07-cadastros.js'
import * as m20261019_08 from './2026-10-19-08-perfis-de-acesso.js'
import * as m20261019_09 from './2026-10-19-09-regiao-do-site.js'
import * as m20261019_10 from './2026-10-19-10-coleta-prevista-obrigatoria.js'
import * as m20261019_11 from './2026-10-19-11-integracoes.js'
import * as m20261020_01 from './2026-10-20-01-lotes-de-fora.js'
import * as m20261020_02 from './2026-10-20-02-ca-do-painel.js'
import * as m20261020_03 from './2026-10-20-03-viagens.js'
import * as m20261020_04 from './2026-10-20-04-historico-do-estoque.js'
import * as m20261022_01 from './2026-10-22-01-configuracoes-do-cliente.js'
import * as m20261022_02 from './2026-10-22-02-rastreio-do-cliente.js'

/**
 * Migrations em ordem. Nova migration: crie `AAAA-MM-DD-NN-assunto.ts` nesta pasta
 * (exportando `up` e `down`) e registre aqui. Nunca altere uma migration já aplicada.
 */
export const migrations: Record<string, Migration> = {
  '2026-10-18-01-usuarios': m20261018_01,
  '2026-10-18-02-clientes': m20261018_02,
  '2026-10-18-03-clientes-logistica-documentos': m20261018_03,
  '2026-10-19-01-transportadoras-motoristas-veiculos': m20261019_01,
  '2026-10-19-02-ordens': m20261019_02,
  '2026-10-19-03-sla-e-etapas-do-lote': m20261019_03,
  '2026-10-19-04-detalhe-do-lote': m20261019_04,
  '2026-10-19-05-tipo-dos-documentos-do-lote': m20261019_05,
  '2026-10-19-06-recebimento': m20261019_06,
  '2026-10-19-07-cadastros': m20261019_07,
  '2026-10-19-08-perfis-de-acesso': m20261019_08,
  '2026-10-19-09-regiao-do-site': m20261019_09,
  '2026-10-19-10-coleta-prevista-obrigatoria': m20261019_10,
  '2026-10-19-11-integracoes': m20261019_11,
  '2026-10-20-01-lotes-de-fora': m20261020_01,
  '2026-10-20-02-ca-do-painel': m20261020_02,
  '2026-10-20-03-viagens': m20261020_03,
  '2026-10-20-04-historico-do-estoque': m20261020_04,
  '2026-10-22-01-configuracoes-do-cliente': m20261022_01,
  '2026-10-22-02-rastreio-do-cliente': m20261022_02,
}
