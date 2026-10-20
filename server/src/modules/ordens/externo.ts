import type { Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { ErroApi } from '../../shared/erros.js'

/*
 * Lote que nasceu num sistema de fora (Gerenciamento de Projetos — pedido do usuário,
 * 20/10/2026: "o iERP vai servir aqui apenas para visualização"). Ele é criado, recebido e
 * concluído LÁ; aqui nada nele muda pela tela: editar, receber, ocorrências e documentos são
 * recusados. Só a sincronização (que vem de lá) mexe nele.
 */

/** Recusa a alteração de um lote que é de um sistema de fora. */
export async function garantirLoteDaqui(cx: Db | Transaction<Database>, ordemId: string) {
  const o = await cx
    .selectFrom('ordens')
    .select('externoSistema')
    .where('id', '=', ordemId)
    .executeTakeFirst()
  if (o?.externoSistema)
    throw new ErroApi(
      409,
      'external_lot',
      'Este lote vem de outro sistema (Gerenciamento de Projetos) e só é alterado lá.',
    )
}
