import type { Migration } from 'kysely/migration'
import * as m20261018_01 from './2026-10-18-01-usuarios.js'

/**
 * Migrations em ordem. Nova migration: crie `AAAA-MM-DD-NN-assunto.ts` nesta pasta
 * (exportando `up` e `down`) e registre aqui. Nunca altere uma migration já aplicada.
 */
export const migrations: Record<string, Migration> = {
  '2026-10-18-01-usuarios': m20261018_01,
}
