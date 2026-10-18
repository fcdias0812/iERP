import type { Db } from './database.js'
import { criarRepositorioUsuarios } from '../modules/usuarios/usuarios.repositorio.js'
import { codigoUsuario } from '../modules/usuarios/usuarios.regras.js'

/*
 * Dados FICTÍCIOS para desenvolvimento (só roda se a tabela de usuários estiver vazia).
 * Nunca rode em produção.
 */
const PESSOAS: [
  string,
  string,
  'admin' | 'operacao' | 'leitura',
  'ativo' | 'bloqueado' | 'inativo',
][] = [
  ['Mariana Albuquerque', 'mariana.albuquerque', 'admin', 'ativo'],
  ['Rafael Moreira', 'rafael.moreira', 'operacao', 'ativo'],
  ['Lia Tanaka', 'lia.tanaka', 'operacao', 'ativo'],
  ['Bruno Carvalho', 'bruno.carvalho', 'leitura', 'ativo'],
  ['Camila Duarte', 'camila.duarte', 'operacao', 'bloqueado'],
  ['Diego Nascimento', 'diego.nascimento', 'operacao', 'ativo'],
  ['Helena Prado', 'helena.prado', 'leitura', 'inativo'],
  ['João Ribeiro', 'joao.ribeiro', 'operacao', 'ativo'],
  ['Patrícia Gomes', 'patricia.gomes', 'admin', 'ativo'],
  ['Thiago Souza', 'thiago.souza', 'leitura', 'ativo'],
  ['Fernanda Lima', 'fernanda.lima', 'operacao', 'ativo'],
  ['Gustavo Pereira', 'gustavo.pereira', 'leitura', 'ativo'],
]

const DIA = 86_400_000

export async function semear(db: Db): Promise<number> {
  const existe = await db.selectFrom('usuarios').select('id').limit(1).executeTakeFirst()
  if (existe) return 0
  const repo = criarRepositorioUsuarios(db)
  const agora = Date.now()
  await repo.transacao(async (trx) => {
    for (const [i, [nome, login, perfil, status]] of PESSOAS.entries()) {
      const criado = new Date(agora - (400 - i * 25) * DIA).toISOString()
      const alterado = new Date(agora - (60 - i * 3) * DIA).toISOString()
      const id = await repo.inserir(
        trx,
        {
          nome,
          email: `${login}@exemplo.com.br`,
          perfil,
          status,
          ultimoAcesso:
            i % 5 === 3 ? null : new Date(agora - (i + 1) * 7 * 3_600_000).toISOString(),
          criadoEm: criado,
          criadoPor: 'Sistema',
          alteradoEm: status === 'ativo' ? criado : alterado,
          alteradoPor: 'Sistema',
        },
        codigoUsuario,
      )
      await repo.registrarHistorico(trx, id, { autor: 'Sistema', em: criado, acao: 'criado' })
      if (status !== 'ativo')
        await repo.registrarHistorico(trx, id, {
          autor: 'Sistema',
          em: alterado,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: 'ativo', depois: status }],
          ...(status === 'bloqueado' ? { nota: 'Tentativas de acesso suspeitas.' } : {}),
        })
    }
  })
  return PESSOAS.length
}
