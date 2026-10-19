import { randomUUID } from 'node:crypto'
import type { Selectable, Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { ClientesDocasTable, ClientesSitesTable, Database } from '../../db/schema.js'
import type { SiteDados } from './clientes-sites.regras.js'
import type { ContatoCliente, Doca, RegiaoBrasil, SiteCliente } from './clientes.types.js'

/* Acesso ao banco: `clientes_sites` e `clientes_docas`. Sem regra de negócio. */

type Conexao = Db | Transaction<Database>

const paraDoca = (d: Selectable<ClientesDocasTable>): Doca => ({
  id: d.id,
  numero: d.numero,
  alturaMaxCaminhao: d.alturaMaxCaminhao,
  comprimentoMaxCaminhao: d.comprimentoMaxCaminhao,
  dockLeveler: d.dockLeveler === 1,
  tailLift: d.tailLift === 1,
  areaLift: d.areaLift,
  espaco: d.espaco,
  altura: d.altura,
  voltagemShredder: d.voltagemShredder,
  pisoProtecaoObrigatorio: d.pisoProtecaoObrigatorio === 1,
})

/** Colunas do site (sem as de controle) a partir dos dados validados. */
const colunasSite = (s: SiteDados, contatoResponsavelId: string | null) => ({
  codigo: s.codigo,
  regiao: s.regiao,
  horario: s.horario,
  totalGaylords: s.totalGaylords,
  cep: s.cep,
  endereco: s.endereco,
  latitude: s.latitude,
  longitude: s.longitude,
  shredderProprio: s.shredderProprio ? 1 : 0,
  edgeSite: s.edgeSite ? 1 : 0,
  contatoResponsavelId,
})

export function criarRepositorioSites(db: Db) {
  async function listar(clienteId: string, cx: Conexao = db): Promise<SiteCliente[]> {
    const sites = await cx
      .selectFrom('clientesSites')
      .selectAll()
      .where('clienteId', '=', clienteId)
      .orderBy('codigo')
      .execute()
    if (!sites.length) return []
    const ids = sites.map((s) => s.id)
    const [docas, contatos] = await Promise.all([
      cx
        .selectFrom('clientesDocas')
        .selectAll()
        .where('siteId', 'in', ids)
        .orderBy('ordem')
        .execute(),
      cx.selectFrom('clientesContatos').selectAll().where('clienteId', '=', clienteId).execute(),
    ])
    const contatoPorId = new Map<string, ContatoCliente>(
      contatos.map((k) => [
        k.id,
        {
          id: k.id,
          nome: k.nome,
          email: k.email,
          telefone: k.telefone,
          principal: k.principal === 1,
        },
      ]),
    )
    return sites.map((s: Selectable<ClientesSitesTable>) => ({
      id: s.id,
      codigo: s.codigo,
      regiao: s.regiao as RegiaoBrasil | null,
      horario: s.horario,
      totalGaylords: s.totalGaylords,
      cep: s.cep,
      endereco: s.endereco,
      latitude: s.latitude,
      longitude: s.longitude,
      shredderProprio: s.shredderProprio === 1,
      edgeSite: s.edgeSite === 1,
      responsavel: s.contatoResponsavelId
        ? (contatoPorId.get(s.contatoResponsavelId) ?? null)
        : null,
      docas: docas.filter((d) => d.siteId === s.id).map(paraDoca),
      criadoEm: s.criadoEm,
      alteradoEm: s.alteradoEm,
    }))
  }

  async function obter(clienteId: string, siteId: string, cx: Conexao = db) {
    return (await listar(clienteId, cx)).find((s) => s.id === siteId)
  }

  /** Outro site do mesmo cliente já usa o código? (sem diferenciar maiúsculas) */
  async function codigoEmUso(
    clienteId: string,
    codigo: string,
    excetoId?: string,
    cx: Conexao = db,
  ) {
    const sites = await cx
      .selectFrom('clientesSites')
      .select(['id', 'codigo'])
      .where('clienteId', '=', clienteId)
      .execute()
    return sites.some((s) => s.id !== excetoId && s.codigo.toLowerCase() === codigo.toLowerCase())
  }

  async function gravarDocas(cx: Conexao, siteId: string, docas: SiteDados['docas']) {
    await cx.deleteFrom('clientesDocas').where('siteId', '=', siteId).execute()
    if (!docas.length) return
    await cx
      .insertInto('clientesDocas')
      .values(
        docas.map((d, i) => ({
          id: randomUUID(),
          siteId,
          numero: d.numero,
          alturaMaxCaminhao: d.alturaMaxCaminhao,
          comprimentoMaxCaminhao: d.comprimentoMaxCaminhao,
          dockLeveler: d.dockLeveler ? 1 : 0,
          tailLift: d.tailLift ? 1 : 0,
          areaLift: d.areaLift,
          espaco: d.espaco,
          altura: d.altura,
          voltagemShredder: d.voltagemShredder,
          pisoProtecaoObrigatorio: d.pisoProtecaoObrigatorio ? 1 : 0,
          ordem: i,
        })),
      )
      .execute()
  }

  async function inserir(
    cx: Conexao,
    clienteId: string,
    dados: SiteDados,
    contatoResponsavelId: string | null,
    autor: string,
  ): Promise<string> {
    const id = randomUUID()
    const agora = new Date().toISOString()
    await cx
      .insertInto('clientesSites')
      .values({
        ...colunasSite(dados, contatoResponsavelId),
        id,
        clienteId,
        criadoEm: agora,
        criadoPor: autor,
        alteradoEm: agora,
        alteradoPor: autor,
      })
      .execute()
    await gravarDocas(cx, id, dados.docas)
    return id
  }

  async function atualizar(
    cx: Conexao,
    siteId: string,
    dados: SiteDados,
    contatoResponsavelId: string | null,
    autor: string,
  ) {
    await cx
      .updateTable('clientesSites')
      .set({
        ...colunasSite(dados, contatoResponsavelId),
        alteradoEm: new Date().toISOString(),
        alteradoPor: autor,
      })
      .where('id', '=', siteId)
      .execute()
    await gravarDocas(cx, siteId, dados.docas)
  }

  async function remover(cx: Conexao, siteId: string) {
    await cx.deleteFrom('clientesSites').where('id', '=', siteId).execute()
  }

  return { listar, obter, codigoEmUso, inserir, atualizar, remover }
}

export type RepositorioSites = ReturnType<typeof criarRepositorioSites>
