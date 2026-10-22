import { fakerPT_BR as faker } from '@faker-js/faker'
import type {
  AcaoCliente,
  DocumentoCliente,
  SiteCliente,
  AcaoUsuario,
  Cliente,
  ClienteResumo,
  ClienteStatus,
  EventoHistorico,
  Notificacao,
  Usuario,
  UsuarioPerfil,
  UsuarioResumo,
  UsuarioStatus,
} from '@/services/types'
import { CONFIGURACOES_PADRAO } from '@/features/clientes/configuracoes'
import { gerarCnpj, seeded } from './generators'

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

/* ------------------------------------------------------------ clientes */

export const TRANSICOES_CLIENTE: Record<
  ClienteStatus,
  Partial<Record<AcaoCliente, ClienteStatus>>
> = {
  ativo: { inativar: 'inativo' },
  inativo: { reativar: 'ativo' },
}

export const acoesCliente = (status: ClienteStatus) =>
  Object.keys(TRANSICOES_CLIENTE[status]) as AcaoCliente[]

export const codigoCliente = (seq: number) => `CLI-${String(seq).padStart(5, '0')}`

export function resumoCliente(c: Cliente): ClienteResumo {
  const p = c.contatos.find((k) => k.principal) ?? c.contatos[0]
  return {
    id: c.id,
    codigo: c.codigo,
    nome: c.nome,
    cnpj: c.cnpj,
    slaDias: c.slaDias,
    contatoNome: p?.nome ?? null,
    contatoEmail: p?.email ?? null,
    contatoTelefone: p?.telefone ?? null,
    contatos: c.contatos.length,
    status: c.status,
    criadoEm: c.criadoEm,
  }
}

const SUFIXOS = ['Ltda', 'S.A.', 'Eireli', 'Comércio Ltda', 'Serviços Ltda']

function gerarClientes(hoje: number): Cliente[] {
  const rand = seeded(1018)
  return Array.from({ length: 36 }, (_, i) => {
    const empresa = `${faker.company.name().replace(/ (e|-) .*$/, '')} ${faker.helpers.arrayElement(SUFIXOS)}`
    const dominio = `${semAcento(empresa.split(' ')[0]!)}.exemplo.com.br`
    const contatos = Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, (_, k) => {
      const nome = `${faker.person.firstName()} ${faker.person.lastName()}`
      return {
        id: `ct${i + 1}-${k}`,
        nome: k === 2 ? null : nome,
        email: k === 2 ? `contato@${dominio}` : `${semAcento(nome.split(' ')[0]!)}@${dominio}`,
        // Celular (11 dígitos, começa com 9) ou fixo (10 dígitos).
        telefone: k === 1 ? `113${faker.string.numeric(7)}` : `119${faker.string.numeric(8)}`,
        principal: k === 0,
      }
    })
    const status = faker.helpers.weightedArrayElement<ClienteStatus>([
      { weight: 9, value: 'ativo' },
      { weight: 1, value: 'inativo' },
    ])
    const criado = hoje - faker.number.int({ min: 10, max: 700 }) * DAY
    const historico: EventoHistorico[] = [
      { id: `hc${i}-0`, autor: ADMIN_SISTEMA, em: new Date(criado).toISOString(), acao: 'criado' },
    ]
    if (status === 'inativo')
      historico.unshift({
        id: `hc${i}-1`,
        autor: ADMIN_SISTEMA,
        em: new Date(criado + 5 * DAY).toISOString(),
        acao: 'status',
        mudancas: [{ campo: 'status', antes: 'ativo', depois: 'inativo' }],
      })
    return {
      id: `cli${String(i + 1).padStart(5, '0')}`,
      codigo: codigoCliente(i + 1),
      nome: empresa,
      cnpj: gerarCnpj(rand, false),
      // SLA fictício (sem usar o faker, para não mudar os outros dados gerados).
      slaDias: [15, 45, null][i % 3] ?? null,
      status,
      configuracoes: {
        ...CONFIGURACOES_PADRAO,
        slaDias: [15, 45, null][i % 3] ?? null,
        // O primeiro cliente de demonstração mostra instruções e o alerta de lote parado (sem
        // regras que mudem o agendamento e o recebimento dos testes).
        ...(i === 0
          ? {
              diasParadoEtapa: 5,
              instrucoes: {
                origem: 'pt-BR' as const,
                textos: {
                  'pt-BR': 'Usar EPI completo. Acesso pela portaria 2.',
                  en: 'Wear full PPE. Access through gate 2.',
                  'zh-TW': '請穿戴完整個人防護裝備。從 2 號門進入。',
                },
                automaticos: ['en' as const, 'zh-TW' as const],
              },
            }
          : {}),
      },
      contatos,
      criadoEm: new Date(criado).toISOString(),
      criadoPor: ADMIN_SISTEMA,
      alteradoEm: historico[0]!.em,
      alteradoPor: ADMIN_SISTEMA,
      historico,
      acoesPermitidas: acoesCliente(status),
    }
  })
}

/** Documento simulado: o conteúdo fica em memória (para o download). */
export type DocumentoDb = DocumentoCliente & { conteudo: Blob }

export interface Db {
  usuarios: Usuario[]
  clientes: Cliente[]
  /** Sites por cliente (Logística). */
  sites: Record<string, SiteCliente[]>
  /** Documentos por cliente. */
  documentos: Record<string, DocumentoDb[]>
  notificacoes: Notificacao[]
  seq: number
  seqClientes: number
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

  const clientes = gerarClientes(hoje)
  // Um site de exemplo no primeiro cliente (com duas docas).
  const primeiro = clientes[0]!
  const sites: Record<string, SiteCliente[]> = {
    [primeiro.id]: [
      {
        id: 'site00001',
        codigo: 'SPO-01',
        regiao: 'sudeste',
        horario: 'seg a sex, 8h às 18h',
        totalGaylords: 24,
        cep: '01001000',
        endereco: 'Praça da Sé, Sé, São Paulo – SP',
        latitude: -23.5503898,
        longitude: -46.633081,
        shredderProprio: true,
        edgeSite: false,
        responsavel: primeiro.contatos[0] ?? null,
        docas: [
          {
            id: 'doca00001',
            numero: 'D1',
            alturaMaxCaminhao: 4.2,
            comprimentoMaxCaminhao: 12,
            dockLeveler: true,
            tailLift: false,
            areaLift: 6,
            espaco: 40,
            altura: 4.5,
            voltagemShredder: 380,
            pisoProtecaoObrigatorio: true,
          },
          {
            id: 'doca00002',
            numero: 'D2',
            alturaMaxCaminhao: 3.8,
            comprimentoMaxCaminhao: null,
            dockLeveler: false,
            tailLift: true,
            areaLift: null,
            espaco: null,
            altura: null,
            voltagemShredder: null,
            pisoProtecaoObrigatorio: false,
          },
        ],
        criadoEm: new Date(hoje - 30 * DAY).toISOString(),
        alteradoEm: new Date(hoje - 30 * DAY).toISOString(),
      },
    ],
  }
  const documentos: Record<string, DocumentoDb[]> = {
    [primeiro.id]: [
      {
        id: 'doc00001',
        tipo: 'contrato',
        nome: 'Contrato de prestação de serviços.pdf',
        extensao: 'pdf',
        tamanho: 18,
        enviadoEm: new Date(hoje - 20 * DAY).toISOString(),
        enviadoPor: ADMIN_SISTEMA,
        conteudo: new Blob(['%PDF-1.4 exemplo'], { type: 'application/pdf' }),
      },
    ],
  }
  return {
    usuarios,
    clientes,
    sites,
    documentos,
    notificacoes,
    seq: usuarios.length,
    seqClientes: clientes.length,
  }
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
