import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { Mudanca } from '../../shared/historico.js'
import type { RepositorioClientes } from './clientes.repositorio.js'
import type { RepositorioSites } from './clientes-sites.repositorio.js'
import { siteInputSchema, type SiteDados } from './clientes-sites.regras.js'
import type { SiteCliente } from './clientes.types.js'

/*
 * Regras de Clientes › Logística (sites e docas). Responsável pelo site: contato existente do
 * cliente, ou um contato novo — que entra também na lista de contatos do cliente.
 * Toda alteração vai para o histórico do cliente.
 */

const codigoEmUso = () =>
  new ErroApi(409, 'site_code_in_use', 'Já existe um site com este código neste cliente.')

/** Campos do site comparados no histórico (chave = campo exibido na tela). */
const CAMPOS_SITE = [
  'codigo',
  'regiao',
  'horario',
  'totalGaylords',
  'cep',
  'endereco',
  'latitude',
  'longitude',
  'shredderProprio',
  'edgeSite',
] as const

/** Docas em texto (para o histórico mostrar antes → depois). */
const resumoDocas = (docas: { numero: string }[]) => docas.map((d) => d.numero).join(', ')
const assinaturaDocas = (docas: Omit<SiteDados['docas'][number], never>[]) =>
  JSON.stringify(
    docas.map((d) => [
      d.numero,
      d.alturaMaxCaminhao,
      d.comprimentoMaxCaminhao,
      d.dockLeveler,
      d.tailLift,
      d.areaLift,
      d.espaco,
      d.altura,
      d.voltagemShredder,
      d.pisoProtecaoObrigatorio,
    ]),
  )

export function criarServicoSites(repo: RepositorioSites, clientes: RepositorioClientes) {
  /** Garante o cliente e resolve o responsável (criando o contato novo, se for o caso). */
  async function responsavel(
    trx: Parameters<Parameters<RepositorioClientes['transacao']>[0]>[0],
    clienteId: string,
    dados: SiteDados,
  ): Promise<{ id: string | null; novoEmail?: string }> {
    const cliente = await clientes.obter(clienteId, trx)
    if (!cliente) throw naoEncontrado('Cliente não encontrado.')
    if (dados.novoContato) {
      const id = await clientes.adicionarContato(trx, clienteId, {
        nome: dados.novoContato.nome,
        email: dados.novoContato.email,
        telefone: dados.novoContato.telefone,
      })
      return { id, novoEmail: dados.novoContato.email }
    }
    if (dados.contatoId && !cliente.contatos.some((k) => k.id === dados.contatoId))
      throw new ErroApi(422, 'validation', 'O responsável precisa ser um contato deste cliente.')
    return { id: dados.contatoId }
  }

  async function obterOuFalhar(clienteId: string, siteId: string) {
    const site = await repo.obter(clienteId, siteId)
    if (!site) throw naoEncontrado('Site não encontrado.')
    return site
  }

  return {
    async listar(clienteId: string) {
      if (!(await clientes.obter(clienteId))) throw naoEncontrado('Cliente não encontrado.')
      return repo.listar(clienteId)
    },

    async criar(clienteId: string, corpo: unknown, autor: string): Promise<SiteCliente> {
      const dados = siteInputSchema.parse(corpo)
      const id = await clientes.transacao(async (trx) => {
        const resp = await responsavel(trx, clienteId, dados)
        if (await repo.codigoEmUso(clienteId, dados.codigo, undefined, trx)) throw codigoEmUso()
        const siteId = await repo.inserir(trx, clienteId, dados, resp.id, autor)
        await clientes.registrarHistorico(trx, clienteId, {
          autor,
          em: new Date().toISOString(),
          acao: 'site_criado',
          nota: dados.codigo,
          ...(resp.novoEmail
            ? { mudancas: [{ campo: 'contatoNovo', antes: null, depois: resp.novoEmail }] }
            : {}),
        })
        return siteId
      })
      return obterOuFalhar(clienteId, id)
    },

    async atualizar(
      clienteId: string,
      siteId: string,
      corpo: unknown,
      autor: string,
    ): Promise<SiteCliente> {
      const dados = siteInputSchema.parse(corpo)
      await clientes.transacao(async (trx) => {
        const atual = await repo.obter(clienteId, siteId, trx)
        if (!atual) throw naoEncontrado('Site não encontrado.')
        const resp = await responsavel(trx, clienteId, dados)
        if (await repo.codigoEmUso(clienteId, dados.codigo, siteId, trx)) throw codigoEmUso()
        // Histórico: antes → depois só do que mudou.
        const mudancas: Mudanca[] = CAMPOS_SITE.filter((k) => atual[k] !== dados[k]).map((k) => ({
          campo: k,
          antes: atual[k],
          depois: dados[k],
        }))
        if ((atual.responsavel?.id ?? null) !== resp.id)
          mudancas.push({
            campo: 'responsavel',
            antes: atual.responsavel?.email ?? null,
            depois: resp.novoEmail ?? dados.novoContato?.email ?? null,
          })
        if (assinaturaDocas(atual.docas) !== assinaturaDocas(dados.docas))
          mudancas.push({
            campo: 'docas',
            antes: resumoDocas(atual.docas) || null,
            depois: resumoDocas(dados.docas) || null,
          })
        // Responsável existente: grava o e-mail dele no "depois".
        const mudResp = mudancas.find((m) => m.campo === 'responsavel')
        if (mudResp && !mudResp.depois && resp.id) {
          const cliente = await clientes.obter(clienteId, trx)
          mudResp.depois = cliente?.contatos.find((k) => k.id === resp.id)?.email ?? null
        }
        if (!mudancas.length) return
        await repo.atualizar(trx, siteId, dados, resp.id, autor)
        await clientes.registrarHistorico(trx, clienteId, {
          autor,
          em: new Date().toISOString(),
          acao: 'site_editado',
          nota: dados.codigo,
          mudancas,
        })
      })
      return obterOuFalhar(clienteId, siteId)
    },

    async remover(clienteId: string, siteId: string, autor: string) {
      await clientes.transacao(async (trx) => {
        const atual = await repo.obter(clienteId, siteId, trx)
        if (!atual) throw naoEncontrado('Site não encontrado.')
        await repo.remover(trx, siteId)
        await clientes.registrarHistorico(trx, clienteId, {
          autor,
          em: new Date().toISOString(),
          acao: 'site_removido',
          nota: atual.codigo,
        })
      })
    },
  }
}

export type ServicoSites = ReturnType<typeof criarServicoSites>
