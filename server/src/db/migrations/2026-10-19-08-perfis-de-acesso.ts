import type { Kysely } from 'kysely'
import { PAGINAS } from '../../shared/paginas.js'
import { normalizar } from '../../shared/texto.js'

/*
 * Administração › Perfis de acesso (pedido do usuário, 19/10/2026): perfis cadastráveis com o
 * nível de cada página do menu (sem acesso / visualizar / editar). Os três perfis que existiam no
 * código viram registros com os MESMOS ids (`admin`, `operacao`, `leitura`) — os usuários mantêm o
 * perfil (`usuarios.perfil` passa a apontar para `perfis_acesso.id`).
 *  - Administrador: fixo (`fixo = 1`), pode tudo, não se edita nem inativa (decisão dele);
 *  - Operação: editar em tudo, menos Administração (como era);
 *  - Leitura: visualizar tudo, menos Administração (como era).
 * Nome e descrição em LocalizedText (JSON).
 */

const texto = (pt: string, en: string, zh: string) =>
  JSON.stringify({ origem: 'pt-BR', textos: { 'pt-BR': pt, en, 'zh-TW': zh } })

const semAdmin = PAGINAS.filter((p) => !p.startsWith('admin.'))

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('perfis_acesso')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('nome', 'text', (c) => c.notNull())
    .addColumn('nome_ordem', 'text', (c) => c.notNull())
    .addColumn('descricao', 'text')
    .addColumn('fixo', 'integer', (c) => c.notNull().defaultTo(0))
    // JSON { "<pagina>": "ver" | "editar" } — página ausente = sem acesso
    .addColumn('permissoes', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('busca', 'text', (c) => c.notNull())
    .addColumn('criado_em', 'text', (c) => c.notNull())
    .addColumn('criado_por', 'text', (c) => c.notNull())
    .addColumn('alterado_em', 'text', (c) => c.notNull())
    .addColumn('alterado_por', 'text', (c) => c.notNull())
    .execute()

  const agora = new Date().toISOString()
  const perfil = (
    id: string,
    nome: [string, string, string],
    descricao: [string, string, string],
    permissoes: Record<string, string>,
    fixo = 0,
  ) => ({
    id,
    nome: texto(...nome),
    nome_ordem: nome[0],
    descricao: texto(...descricao),
    fixo,
    permissoes: JSON.stringify(permissoes),
    status: 'ativo',
    busca: normalizar(nome.join(' ')),
    criado_em: agora,
    criado_por: 'Sistema',
    alterado_em: agora,
    alterado_por: 'Sistema',
  })
  await db
    .insertInto('perfis_acesso' as never)
    .values([
      perfil(
        'admin',
        ['Administrador', 'Administrator', '管理員'],
        ['Acesso total ao sistema.', 'Full access to the system.', '系統完整存取權限。'],
        {},
        1,
      ),
      perfil(
        'operacao',
        ['Operação', 'Operations', '營運'],
        [
          'Edita tudo, menos a Administração.',
          'Edits everything except Administration.',
          '可編輯所有項目，管理除外。',
        ],
        Object.fromEntries(semAdmin.map((p) => [p, 'editar'])),
      ),
      perfil(
        'leitura',
        ['Leitura', 'Read-only', '唯讀'],
        [
          'Visualiza tudo, menos a Administração.',
          'Views everything except Administration.',
          '可檢視所有項目，管理除外。',
        ],
        Object.fromEntries(semAdmin.map((p) => [p, 'ver'])),
      ),
    ] as never)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('perfis_acesso').execute()
}
