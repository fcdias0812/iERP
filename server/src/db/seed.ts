import type { Db } from './database.js'
import { criarRepositorioClientes } from '../modules/clientes/clientes.repositorio.js'
import { codigoCliente } from '../modules/clientes/clientes.regras.js'
import { criarRepositorioUsuarios } from '../modules/usuarios/usuarios.repositorio.js'
import { codigoUsuario } from '../modules/usuarios/usuarios.regras.js'

/*
 * Dados FICTÍCIOS para desenvolvimento (cada tabela só é semeada se estiver vazia).
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

/** Semeia o que estiver vazio. Devolve quantos registros criou. */
export async function semear(db: Db): Promise<number> {
  return (await semearUsuarios(db)) + (await semearClientes(db))
}

async function semearUsuarios(db: Db): Promise<number> {
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

/* ------------------------------------------------------------ clientes */

/** CNPJ fictício válido a partir de 8 dígitos de raiz (filial 0001). */
function cnpjFicticio(raiz: string): string {
  const n = `${raiz}0001`.split('').map(Number)
  const dv = (len: number) => {
    const pesos =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = pesos.reduce((acc, p, i) => acc + p * n[i]!, 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  n.push(dv(12))
  n.push(dv(13))
  return n.join('')
}

const CLIENTES: [string, string, 'ativo' | 'inativo', [string | null, string, string][]][] = [
  [
    'TechNova Eletrônicos Ltda',
    '11222333',
    'ativo',
    [
      ['Carla Mendes', 'carla.mendes@technova.exemplo.com.br', '11987654321'],
      ['Financeiro', 'financeiro@technova.exemplo.com.br', '1133224455'],
    ],
  ],
  [
    'Verde Recicla S.A.',
    '45678912',
    'ativo',
    [['Paulo Henrique', 'paulo@verderecicla.exemplo.com.br', '21998761234']],
  ],
  [
    'Alfa Telecom Brasil Ltda',
    '30112233',
    'ativo',
    [
      ['Juliana Rocha', 'juliana.rocha@alfatelecom.exemplo.com.br', '31991234567'],
      ['Marcos Vieira', 'marcos.vieira@alfatelecom.exemplo.com.br', '31992345678'],
      [null, 'logistica@alfatelecom.exemplo.com.br', '3132145678'],
    ],
  ],
  [
    'Banco Horizonte S.A.',
    '60987654',
    'ativo',
    [['Ricardo Lopes', 'ricardo.lopes@horizonte.exemplo.com.br', '11976543210']],
  ],
  [
    'Rede Varejo Sul Ltda',
    '72345678',
    'ativo',
    [['Aline Costa', 'aline.costa@varejosul.exemplo.com.br', '51998887766']],
  ],
  [
    'Clínica Vida Plena Ltda',
    '81234567',
    'inativo',
    [['Sérgio Almeida', 'sergio@vidaplena.exemplo.com.br', '4133445566']],
  ],
  [
    'Construtora Pilar Ltda',
    '25836914',
    'ativo',
    [['Beatriz Nunes', 'beatriz.nunes@pilar.exemplo.com.br', '62981112233']],
  ],
  [
    'Escola Saber Mais Ltda',
    '14725836',
    'ativo',
    [['Coordenação de TI', 'ti@sabermais.exemplo.com.br', '8534567890']],
  ],
]

async function semearClientes(db: Db): Promise<number> {
  const existe = await db.selectFrom('clientes').select('id').limit(1).executeTakeFirst()
  if (existe) return 0
  const repo = criarRepositorioClientes(db)
  const agora = Date.now()
  await repo.transacao(async (trx) => {
    for (const [i, [nome, raiz, status, contatos]] of CLIENTES.entries()) {
      const criado = new Date(agora - (300 - i * 30) * DIA).toISOString()
      const alterado = new Date(agora - (40 - i * 3) * DIA).toISOString()
      const id = await repo.inserir(
        trx,
        {
          nome,
          cnpj: cnpjFicticio(raiz),
          status,
          criadoEm: criado,
          criadoPor: 'Sistema',
          alteradoEm: status === 'ativo' ? criado : alterado,
          alteradoPor: 'Sistema',
        },
        contatos.map(([n, email, telefone], k) => ({
          nome: n,
          email,
          telefone,
          principal: k === 0,
        })),
        codigoCliente,
      )
      await repo.registrarHistorico(trx, id, { autor: 'Sistema', em: criado, acao: 'criado' })
      if (status === 'inativo')
        await repo.registrarHistorico(trx, id, {
          autor: 'Sistema',
          em: alterado,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: 'ativo', depois: 'inativo' }],
        })
    }
  })
  return CLIENTES.length
}
