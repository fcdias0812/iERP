import { randomUUID } from 'node:crypto'
import type { Db } from './database.js'
import {
  buscaTransportadora,
  inserirMotorista,
  inserirTransportadora,
} from '../modules/relacionamento.basico.js'
import { registrarHistorico } from '../shared/historico.repositorio.js'
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
  return (await semearUsuarios(db)) + (await semearClientes(db)) + (await semearRelacionamento(db))
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

/* ------------------------------------------------------------ relacionamento */

/** CPF fictício válido a partir de 9 dígitos. */
function cpfFicticio(base: string): string {
  const n = base.split('').map(Number)
  const dv = (len: number) => {
    const soma = n.slice(0, len).reduce((acc, x, i) => acc + x * (len + 1 - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  n.push(dv(9))
  n.push(dv(10))
  return n.join('')
}

const TRANSPORTADORAS: [string, string, [string | null, string, string][]][] = [
  [
    'Rápido Sul Transportes Ltda',
    '33445566',
    [['Luciana Prado', 'luciana@rapidosul.exemplo.com.br', '51998765432']],
  ],
  [
    'TransLog Express Ltda',
    '44556677',
    [
      ['Operações', 'operacoes@translog.exemplo.com.br', '1133445566'],
      ['Fábio Teixeira', 'fabio@translog.exemplo.com.br', '11987001122'],
    ],
  ],
  ['Carga Certa Logística Ltda', '55667788', []],
]

const MOTORISTAS: [string, string, string, number | null][] = [
  ['Antônio Carlos Silva', '123456780', '51991112222', 0],
  ['Bruna Ferreira Lima', '234567891', '11992223333', 1],
  ['Cláudio Mendes Rocha', '345678912', '11993334444', 1],
  ['Daniela Souza Pires', '456789123', '21994445555', null],
]

const VEICULOS: ['truck' | 'carreta' | 'van', number, number, number, number, number, number][] = [
  // tipo, vol. mín (m²), vol. máx (m²), comprimento (m), largura (m), pallets, toneladas
  ['van', 4, 8, 3.2, 1.7, 4, 1.5],
  ['truck', 14, 28, 8.5, 2.5, 12, 12],
  ['carreta', 30, 45, 14.6, 2.6, 28, 32],
]

export async function semearRelacionamento(db: Db): Promise<number> {
  const existe = await db.selectFrom('transportadoras').select('id').limit(1).executeTakeFirst()
  if (existe) return 0
  await db.transaction().execute(async (trx) => {
    const ids: string[] = []
    for (const [nome, raiz, contatos] of TRANSPORTADORAS) {
      const id = await inserirTransportadora(trx, { nome, cnpj: cnpjFicticio(raiz) }, 'Sistema')
      ids.push(id)
      for (const [i, [n, email, telefone]] of contatos.entries())
        await trx
          .insertInto('transportadorasContatos')
          .values({
            id: randomUUID(),
            transportadoraId: id,
            nome: n,
            email,
            telefone,
            principal: i === 0 ? 1 : 0,
            ordem: i,
          })
          .execute()
      const t = await trx
        .selectFrom('transportadoras')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
      await trx
        .updateTable('transportadoras')
        .set({
          busca: buscaTransportadora(
            t,
            contatos.map(([n, email, telefone]) => ({ nome: n, email, telefone })),
          ),
        })
        .where('id', '=', id)
        .execute()
    }
    for (const [nome, base, telefone, t] of MOTORISTAS)
      await inserirMotorista(
        trx,
        { nome, cpf: cpfFicticio(base), telefone, transportadoraId: t === null ? null : ids[t]! },
        'Sistema',
      )
    for (const [i, [tipo, vmin, vmax, comp, larg, pallets, ton]] of VEICULOS.entries()) {
      const agora = new Date().toISOString()
      const id = randomUUID()
      await trx
        .insertInto('veiculos')
        .values({
          id,
          numero: i + 1,
          codigo: `VEI-${String(i + 1).padStart(5, '0')}`,
          tipo,
          volumeMinimo: vmin,
          volumeMaximo: vmax,
          comprimento: comp,
          largura: larg,
          capacidadePallets: pallets,
          capacidadeToneladas: ton,
          status: 'ativo',
          busca: `vei-${String(i + 1).padStart(5, '0')} ${tipo}`,
          criadoEm: agora,
          criadoPor: 'Sistema',
          alteradoEm: agora,
          alteradoPor: 'Sistema',
        })
        .execute()
      await registrarHistorico(trx, 'veiculo', id, { autor: 'Sistema', em: agora, acao: 'criado' })
    }
  })
  return TRANSPORTADORAS.length + MOTORISTAS.length + VEICULOS.length
}
