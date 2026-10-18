import { fakerPT_BR as faker } from '@faker-js/faker'
import type {
  AcaoUsuario,
  EventoHistorico,
  Notificacao,
  Usuario,
  UsuarioPerfil,
  UsuarioResumo,
  UsuarioStatus,
} from '@/services/types'

/*
 * "Banco de dados" do servidor simulado, em memória, gerado com faker pt_BR e
 * semente fixa (mesmos dados a cada recarga). Alterações valem até recarregar a página.
 * Datas relativas a hoje.
 */

const DAY = 86_400_000

/* ------------------------------------------------------------ regras do fluxo */

/** Fluxo do usuário: Ativo ⇄ Bloqueado; Ativo/Bloqueado → Inativo → Ativo. */
export const TRANSICOES: Record<UsuarioStatus, Partial<Record<AcaoUsuario, UsuarioStatus>>> = {
  ativo: { bloquear: 'bloqueado', inativar: 'inativo' },
  bloqueado: { desbloquear: 'ativo', inativar: 'inativo' },
  inativo: { reativar: 'ativo' },
}

export function acoesDe(status: UsuarioStatus): AcaoUsuario[] {
  return Object.keys(TRANSICOES[status]) as AcaoUsuario[]
}

export function resumoDe(u: Usuario): UsuarioResumo {
  return {
    id: u.id,
    codigo: u.codigo,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    status: u.status,
    ultimoAcesso: u.ultimoAcesso,
    criadoEm: u.criadoEm,
  }
}

/** Código legível do usuário: USR-00001. */
export const codigoUsuario = (seq: number) => `USR-${String(seq).padStart(5, '0')}`

/** E-mail normalizado (comparação sem diferença de maiúsculas/espaços). */
export const normEmail = (email: string) => email.trim().toLowerCase()

/* ------------------------------------------------------------ geração */

const PERFIS_PESOS: { weight: number; value: UsuarioPerfil }[] = [
  { weight: 1, value: 'admin' },
  { weight: 5, value: 'operacao' },
  { weight: 3, value: 'leitura' },
]
const STATUS_PESOS: { weight: number; value: UsuarioStatus }[] = [
  { weight: 8, value: 'ativo' },
  { weight: 1, value: 'bloqueado' },
  { weight: 1, value: 'inativo' },
]
const ADMIN_SISTEMA = 'Mariana Albuquerque'

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')

export interface Db {
  usuarios: Usuario[]
  notificacoes: Notificacao[]
  seq: number
}

function gerar(): Db {
  faker.seed(20261018)
  const hoje = Date.now()
  const emails = new Set<string>()

  const usuarios: Usuario[] = Array.from({ length: 48 }, (_, i) => {
    // firstName + lastName (person.fullName às vezes põe "Dr.", "Sra.").
    const nome = `${faker.person.firstName()} ${faker.person.lastName()}`
    let email = `${semAcento(nome.split(' ')[0]!)}.${semAcento(nome.split(' ').at(-1)!)}@exemplo.com.br`
    if (emails.has(email)) email = email.replace('@', `${i}@`)
    emails.add(email)
    const status = faker.helpers.weightedArrayElement(STATUS_PESOS)
    const criado = hoje - faker.number.int({ min: 20, max: 900 }) * DAY
    const nuncaAcessou = faker.number.int({ min: 1, max: 10 }) === 1
    const ultimoAcesso = nuncaAcessou
      ? null
      : new Date(
          Math.max(criado, hoje - faker.number.int({ min: 0, max: 60 * 24 * 60 }) * 60_000),
        ).toISOString()
    const historico: EventoHistorico[] = [
      { id: `h${i}-0`, autor: ADMIN_SISTEMA, em: new Date(criado).toISOString(), acao: 'criado' },
    ]
    let alterado = criado
    if (status !== 'ativo') {
      alterado = criado + faker.number.int({ min: 5, max: 15 }) * DAY
      historico.unshift({
        id: `h${i}-1`,
        autor: ADMIN_SISTEMA,
        em: new Date(alterado).toISOString(),
        acao: 'status',
        mudancas: [{ campo: 'status', antes: 'ativo', depois: status }],
        nota: status === 'bloqueado' ? 'Tentativas de acesso suspeitas.' : undefined,
      })
    }
    return {
      id: `usr${String(i + 1).padStart(5, '0')}`,
      codigo: codigoUsuario(i + 1),
      nome,
      email,
      perfil: i === 0 ? 'admin' : faker.helpers.weightedArrayElement(PERFIS_PESOS),
      status: i === 0 ? 'ativo' : status,
      ultimoAcesso,
      criadoEm: new Date(criado).toISOString(),
      criadoPor: ADMIN_SISTEMA,
      alteradoEm: new Date(alterado).toISOString(),
      alteradoPor: ADMIN_SISTEMA,
      historico: i === 0 ? historico.slice(-1) : historico,
      acoesPermitidas: [],
    }
  }).map((u) => ({ ...u, acoesPermitidas: acoesDe(u.status) }))

  const bloqueado = usuarios.find((u) => u.status === 'bloqueado')
  const recente = usuarios[1]!
  const notificacoes: Notificacao[] = [
    ...(bloqueado
      ? [
          {
            id: 'n1',
            tipo: 'usuario_bloqueado' as const,
            parametros: { name: bloqueado.nome },
            tom: 'inactive' as const,
            em: new Date(hoje - 2 * 3_600_000).toISOString(),
            lida: false,
            rota: `/admin/usuarios/${bloqueado.id}`,
          },
        ]
      : []),
    {
      id: 'n2',
      tipo: 'usuario_criado',
      parametros: { name: recente.nome },
      tom: 'info',
      em: new Date(hoje - 26 * 3_600_000).toISOString(),
      lida: true,
      rota: `/admin/usuarios/${recente.id}`,
    },
  ]

  return { usuarios, notificacoes, seq: usuarios.length }
}

let db: Db | null = null

/** O banco (gerado na primeira chamada). */
export function getDb(): Db {
  db ??= gerar()
  return db
}

/** Recria o banco do zero (testes). */
export function resetDb() {
  db = gerar()
  return db
}
