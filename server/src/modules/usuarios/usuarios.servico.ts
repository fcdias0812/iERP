import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { ConsultaTabela } from '../../shared/consulta-tabela.js'
import type { RepositorioUsuarios } from './usuarios.repositorio.js'
import {
  TRANSICOES,
  codigoUsuario,
  usuarioInputSchema,
  transicaoSchema,
} from './usuarios.regras.js'
import type { Mudanca, UsuarioInput, UsuariosResumo } from './usuarios.types.js'

/* Regras de negócio de Admin › Usuários (validação, e-mail único, fluxo de status, histórico). */

const emailEmUso = () => new ErroApi(409, 'email_in_use', 'Já existe um usuário com este e-mail.')
const CAMPOS_EDITAVEIS: (keyof UsuarioInput)[] = ['nome', 'email', 'perfil']

/** Perfil inexistente ou inativo. */
const perfilInvalido = () => new ErroApi(422, 'validation', 'Escolha um perfil de acesso ativo.')

export function criarServicoUsuarios(repo: RepositorioUsuarios) {
  return {
    listar: (consulta: ConsultaTabela) => repo.listar(consulta),

    async resumo(): Promise<UsuariosResumo> {
      const c = await repo.contarPorStatus()
      const ativos = c.ativo ?? 0
      const bloqueados = c.bloqueado ?? 0
      const inativos = c.inativo ?? 0
      return { total: ativos + bloqueados + inativos, ativos, bloqueados, inativos }
    },

    async obter(id: string) {
      const u = await repo.obter(id)
      if (!u) throw naoEncontrado('Usuário não encontrado.')
      return u
    },

    async criar(corpo: unknown, autor: string) {
      const dados = usuarioInputSchema.parse(corpo)
      const id = await repo.transacao(async (trx) => {
        if (await repo.emailEmUso(dados.email, undefined, trx)) throw emailEmUso()
        if (!(await repo.perfilAtivo(dados.perfil, trx))) throw perfilInvalido()
        const agora = new Date().toISOString()
        const novoId = await repo.inserir(
          trx,
          {
            ...dados,
            status: 'ativo',
            ultimoAcesso: null,
            criadoEm: agora,
            criadoPor: autor,
            alteradoEm: agora,
            alteradoPor: autor,
          },
          codigoUsuario,
        )
        await repo.registrarHistorico(trx, novoId, { autor, em: agora, acao: 'criado' })
        return novoId
      })
      return (await repo.obter(id))!
    },

    async atualizar(id: string, corpo: unknown, autor: string) {
      const dados = usuarioInputSchema.parse(corpo)
      await repo.transacao(async (trx) => {
        const atual = await repo.obter(id, trx)
        if (!atual) throw naoEncontrado('Usuário não encontrado.')
        if (await repo.emailEmUso(dados.email, id, trx)) throw emailEmUso()
        if (dados.perfil !== atual.perfil && !(await repo.perfilAtivo(dados.perfil, trx)))
          throw perfilInvalido()
        // Histórico com antes → depois só do que mudou.
        const mudancas: Mudanca[] = CAMPOS_EDITAVEIS.filter((k) => atual[k] !== dados[k]).map(
          (k) => ({ campo: k, antes: atual[k], depois: dados[k] }),
        )
        if (!mudancas.length) return
        const agora = new Date().toISOString()
        await repo.atualizar(trx, id, { ...dados, alteradoEm: agora, alteradoPor: autor })
        await repo.registrarHistorico(trx, id, { autor, em: agora, acao: 'editado', mudancas })
      })
      return (await repo.obter(id))!
    },

    async transicionar(id: string, corpo: unknown, autor: string) {
      const { acao, motivo } = transicaoSchema.parse(corpo)
      await repo.transacao(async (trx) => {
        const atual = await repo.obter(id, trx)
        if (!atual) throw naoEncontrado('Usuário não encontrado.')
        const destino = TRANSICOES[atual.status][acao]
        if (!destino)
          throw new ErroApi(
            409,
            'invalid_transition',
            `Ação "${acao}" não é permitida no status atual.`,
          )
        if (acao === 'bloquear' && !motivo)
          throw new ErroApi(422, 'validation', 'Informe o motivo do bloqueio.')
        const agora = new Date().toISOString()
        await repo.atualizar(trx, id, { status: destino, alteradoEm: agora, alteradoPor: autor })
        await repo.registrarHistorico(trx, id, {
          autor,
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
          ...(motivo ? { nota: motivo } : {}),
        })
      })
      return (await repo.obter(id))!
    },

    buscar: (termo: string) => repo.buscar(termo),
  }
}

export type ServicoUsuarios = ReturnType<typeof criarServicoUsuarios>
