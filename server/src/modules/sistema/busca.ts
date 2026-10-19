import { sql, type SqlBool } from 'kysely'
import type { Db } from '../../db/database.js'
import { cidadeDoEndereco } from '../../shared/endereco.js'
import { escaparLike, normalizar } from '../../shared/texto.js'
import type { ServicoClientes } from '../clientes/clientes.servico.js'
import type { ServicoMotoristas } from '../motoristas/motoristas.js'
import type { LocalizedText } from '../ordens/ordens.lote.js'
import type { ServicoTransportadoras } from '../transportadoras/transportadoras.js'
import type { ServicoUsuarios } from '../usuarios/usuarios.servico.js'

/*
 * Busca global da barra do topo (Ctrl+K) — "absolutamente tudo" (pedido do usuário,
 * 19/10/2026): clientes, sites, transportadoras, motoristas, veículos, lotes, caixotes, pallets,
 * materiais, áreas do estoque, usuários e perfis de acesso. Até 5 de cada tipo, pelo código, nome
 * ou texto de busca (sem acento, sem diferenciar maiúsculas). O FRONTEND monta o link de cada
 * tipo e esconde o que o perfil não pode ver. Viagens entram quando o módulo existir.
 */

export type TipoBusca =
  | 'cliente'
  | 'site'
  | 'transportadora'
  | 'motorista'
  | 'veiculo'
  | 'lote'
  | 'caixote'
  | 'pallet'
  | 'material'
  | 'area'
  | 'usuario'
  | 'perfil'

export interface ResultadoBusca {
  tipo: TipoBusca
  id: string
  codigo: string
  titulo: string
  /** Nome nos 3 idiomas (materiais e perfis): a tela mostra no idioma dela. */
  tituloTraduzido?: LocalizedText
  /** Informação extra curta (cidade do site, cliente do lote, material do caixote…). */
  detalhe?: string | null
  /** Registro "pai" (o cliente do site). */
  paiId?: string
}

const POR_TIPO = 5

export function criarBuscaGlobal(
  db: Db,
  servicos: {
    usuarios: ServicoUsuarios
    clientes: ServicoClientes
    transportadoras: ServicoTransportadoras
    motoristas: ServicoMotoristas
  },
) {
  return async function buscar(q: string): Promise<ResultadoBusca[]> {
    const termo = `%${escaparLike(normalizar(q))}%`
    /** Coluna `busca` (texto normalizado) contém o termo. */
    const naBusca = (coluna: string) => sql<SqlBool>`${sql.ref(coluna)} like ${termo} escape '\\'`
    /** Texto livre (sem coluna `busca`) contém o termo — `lower` existe nos dois bancos. */
    const noTexto = (coluna: string) =>
      sql<SqlBool>`lower(${sql.ref(coluna)}) like ${termo} escape '\\'`

    const [clientes, usuarios, transportadoras, motoristas, sites, veiculos, lotes, recipientes] =
      await Promise.all([
        servicos.clientes.buscar(q),
        servicos.usuarios.buscar(q),
        servicos.transportadoras.buscar(q),
        servicos.motoristas.buscar(q),
        db
          .selectFrom('clientesSites as s')
          .innerJoin('clientes as c', 'c.id', 's.clienteId')
          .select(['s.id', 's.codigo', 's.endereco', 's.clienteId', 'c.nome as clienteNome'])
          .where((eb) => eb.or([noTexto('s.codigo'), noTexto('s.endereco')]))
          .orderBy('s.codigo')
          .limit(POR_TIPO)
          .execute(),
        db
          .selectFrom('veiculos')
          .select(['id', 'codigo', 'tipo'])
          .where(naBusca('busca'))
          .orderBy('codigo')
          .limit(POR_TIPO)
          .execute(),
        db
          .selectFrom('ordensLista')
          .select(['id', 'codigo', 'clienteNome', 'siteCodigo'])
          .where(naBusca('busca'))
          .orderBy('codigo', 'desc')
          .limit(POR_TIPO)
          .execute(),
        db
          .selectFrom('recipientes as r')
          .innerJoin('materiais as m', 'm.id', 'r.materialId')
          .select(['r.id', 'r.tipo', 'r.codigo', 'r.posicao', 'm.nome as material'])
          .where(naBusca('r.busca'))
          .orderBy('r.codigo')
          .limit(POR_TIPO * 2)
          .execute(),
      ])
    const [materiais, areas, perfis] = await Promise.all([
      db
        .selectFrom('materiais')
        .select(['id', 'nome', 'nomeOrdem'])
        .where(naBusca('busca'))
        .orderBy('nomeOrdem')
        .limit(POR_TIPO)
        .execute(),
      db
        .selectFrom('areasEstoque')
        .select(['id', 'nome', 'descricao'])
        .where(naBusca('busca'))
        .orderBy('nome')
        .limit(POR_TIPO)
        .execute(),
      db
        .selectFrom('perfisAcesso')
        .select(['id', 'nome', 'nomeOrdem'])
        .where(naBusca('busca'))
        .orderBy('nomeOrdem')
        .limit(POR_TIPO)
        .execute(),
    ])
    const traduzido = (json: string) => JSON.parse(json) as LocalizedText
    const recipientesDo = (tipo: 'caixote' | 'pallet') =>
      recipientes
        .filter((r) => r.tipo === tipo)
        .slice(0, POR_TIPO)
        .map((r) => ({
          tipo,
          id: r.id,
          codigo: r.codigo,
          titulo: traduzido(r.material).textos['pt-BR'] ?? '',
          tituloTraduzido: traduzido(r.material),
          detalhe: r.posicao,
        }))

    return [
      ...clientes
        .slice(0, POR_TIPO)
        .map((c) => ({ tipo: 'cliente' as const, id: c.id, codigo: c.codigo, titulo: c.nome })),
      ...sites.map((s) => ({
        tipo: 'site' as const,
        id: s.id,
        codigo: s.codigo,
        titulo: s.clienteNome,
        detalhe: cidadeDoEndereco(s.endereco),
        paiId: s.clienteId,
      })),
      ...lotes.map((l) => ({
        tipo: 'lote' as const,
        id: l.id,
        codigo: l.codigo,
        titulo: l.clienteNome,
        detalhe: l.siteCodigo,
      })),
      ...recipientesDo('caixote'),
      ...recipientesDo('pallet'),
      ...transportadoras.slice(0, POR_TIPO).map((t) => ({
        tipo: 'transportadora' as const,
        id: t.id,
        codigo: t.codigo,
        titulo: t.nome,
      })),
      ...motoristas
        .slice(0, POR_TIPO)
        .map((m) => ({ tipo: 'motorista' as const, id: m.id, codigo: m.codigo, titulo: m.nome })),
      ...veiculos.map((v) => ({
        tipo: 'veiculo' as const,
        id: v.id,
        codigo: v.codigo,
        titulo: v.tipo,
      })),
      ...materiais.map((m) => ({
        tipo: 'material' as const,
        id: m.id,
        codigo: '',
        titulo: m.nomeOrdem,
        tituloTraduzido: traduzido(m.nome),
      })),
      ...areas.map((a) => ({
        tipo: 'area' as const,
        id: a.id,
        codigo: '',
        titulo: a.nome,
      })),
      ...usuarios
        .slice(0, POR_TIPO)
        .map((u) => ({ tipo: 'usuario' as const, id: u.id, codigo: u.codigo, titulo: u.nome })),
      ...perfis.map((p) => ({
        tipo: 'perfil' as const,
        id: p.id,
        codigo: '',
        titulo: p.nomeOrdem,
        tituloTraduzido: traduzido(p.nome),
      })),
    ]
  }
}
