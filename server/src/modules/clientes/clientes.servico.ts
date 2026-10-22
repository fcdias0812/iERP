import type { ConsultaTabela } from '../../shared/consulta-tabela.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { Mudanca } from '../../shared/historico.js'
import { sistemaDoCliente } from '../integracao/destinos.js'
import type { RepositorioClientes } from './clientes.repositorio.js'
import {
  TRANSICOES,
  clienteInputSchema,
  codigoCliente,
  transicaoSchema,
} from './clientes.regras.js'
import type { Cliente, ClientesResumo } from './clientes.types.js'

/* Regras de negócio de Clientes (validação, CNPJ único, contatos, fluxo de status, histórico). */

const cnpjEmUso = () => new ErroApi(409, 'cnpj_in_use', 'Já existe um cliente com este CNPJ.')
const naoAchou = () => naoEncontrado('Cliente não encontrado.')

/** Contatos em texto (para o histórico mostrar antes → depois). */
const resumoContatos = (l: { email: string; principal: boolean }[]) =>
  l.map((c) => (c.principal ? `${c.email} (principal)` : c.email)).join(', ')

const semId = (l: Cliente['contatos']) =>
  JSON.stringify(l.map((c) => [c.nome, c.email, c.telefone, c.principal]))

export function criarServicoClientes(repo: RepositorioClientes) {
  return {
    listar: (consulta: ConsultaTabela) => repo.listar(consulta),

    async resumo(): Promise<ClientesResumo> {
      const c = await repo.contarPorStatus()
      const ativos = c.ativo ?? 0
      const inativos = c.inativo ?? 0
      return { total: ativos + inativos, ativos, inativos }
    },

    async obter(id: string) {
      const c = await repo.obter(id)
      if (!c) throw naoAchou()
      return c
    },

    async criar(corpo: unknown, autor: string) {
      const { contatos, ...dados } = clienteInputSchema.parse(corpo)
      const id = await repo.transacao(async (trx) => {
        if (await repo.cnpjEmUso(dados.cnpj, undefined, trx)) throw cnpjEmUso()
        const agora = new Date().toISOString()
        const novoId = await repo.inserir(
          trx,
          {
            ...dados,
            slaDias: dados.slaDias ?? null,
            // Cliente novo da Dell já nasce indo para o MoonShot (a regra de antes, pelo nome);
            // depois, quem decide é a aba Configurações.
            sistemaProcessamento: sistemaDoCliente(dados.nome),
            status: 'ativo',
            criadoEm: agora,
            criadoPor: autor,
            alteradoEm: agora,
            alteradoPor: autor,
          },
          contatos,
          codigoCliente,
        )
        await repo.registrarHistorico(trx, novoId, { autor, em: agora, acao: 'criado' })
        return novoId
      })
      return (await repo.obter(id))!
    },

    async atualizar(id: string, corpo: unknown, autor: string) {
      const { contatos, ...dados } = clienteInputSchema.parse(corpo)
      await repo.transacao(async (trx) => {
        const atual = await repo.obter(id, trx)
        if (!atual) throw naoAchou()
        if (await repo.cnpjEmUso(dados.cnpj, id, trx)) throw cnpjEmUso()
        // Histórico com antes → depois só do que mudou.
        const mudancas: Mudanca[] = (['nome', 'cnpj', 'slaDias'] as const)
          .filter((k) => dados[k] !== undefined && atual[k] !== dados[k])
          .map((k) => ({ campo: k, antes: atual[k], depois: dados[k] ?? null }))
        const novos = contatos.map((c) => ({ ...c, id: '' }))
        const contatosMudaram = semId(atual.contatos) !== semId(novos)
        if (contatosMudaram)
          mudancas.push({
            campo: 'contatos',
            antes: resumoContatos(atual.contatos),
            depois: resumoContatos(contatos),
          })
        if (!mudancas.length) return
        const agora = new Date().toISOString()
        await repo.atualizar(
          trx,
          id,
          { ...dados, alteradoEm: agora, alteradoPor: autor },
          contatosMudaram ? contatos : undefined,
        )
        await repo.registrarHistorico(trx, id, { autor, em: agora, acao: 'editado', mudancas })
      })
      return (await repo.obter(id))!
    },

    async transicionar(id: string, corpo: unknown, autor: string) {
      const { acao } = transicaoSchema.parse(corpo)
      await repo.transacao(async (trx) => {
        const atual = await repo.obter(id, trx)
        if (!atual) throw naoAchou()
        const destino = TRANSICOES[atual.status][acao]
        if (!destino)
          throw new ErroApi(
            409,
            'invalid_transition',
            `Ação "${acao}" não é permitida no status atual.`,
          )
        const agora = new Date().toISOString()
        await repo.atualizar(trx, id, { status: destino, alteradoEm: agora, alteradoPor: autor })
        await repo.registrarHistorico(trx, id, {
          autor,
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
        })
      })
      return (await repo.obter(id))!
    },

    buscar: (termo: string) => repo.buscar(termo),
  }
}

export type ServicoClientes = ReturnType<typeof criarServicoClientes>
