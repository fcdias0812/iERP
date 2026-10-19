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
}
