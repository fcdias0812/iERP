import { sql, type Kysely } from 'kysely'
import { regiaoDaUf, regiaoDoTexto, type RegiaoBrasil } from '../../shared/regioes.js'

/*
 * Região do site vira lista fechada (pedido do usuário, 19/10/2026): norte, nordeste,
 * centro_oeste, sudeste, sul. O texto livre de antes vira o código: o nome da região
 * ("Sudeste") ou, se não for uma, a UF do fim do endereço ("…, Campinas – SP"); senão, vazio.
 */

const NOMES: Record<RegiaoBrasil, string> = {
  norte: 'Norte',
  nordeste: 'Nordeste',
  centro_oeste: 'Centro-Oeste',
  sudeste: 'Sudeste',
  sul: 'Sul',
}

interface Linha {
  id: string
  regiao: string | null
  endereco: string | null
}

export async function up(db: Kysely<unknown>): Promise<void> {
  const { rows } = await sql<Linha>`select id, regiao, endereco from clientes_sites
    where regiao is not null and regiao <> ''`.execute(db)
  for (const s of rows) {
    const uf = s.endereco?.match(/[–-]\s*([A-Za-z]{2})\s*$/)?.[1]
    const codigo = regiaoDoTexto(s.regiao) ?? regiaoDaUf(uf)
    await sql`update clientes_sites set regiao = ${codigo} where id = ${s.id}`.execute(db)
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const [codigo, nome] of Object.entries(NOMES))
    await sql`update clientes_sites set regiao = ${nome} where regiao = ${codigo}`.execute(db)
}
