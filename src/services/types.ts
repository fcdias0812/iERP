import type { TablePage } from '@/components/data-table/types'
import type { Role } from '@/config/permissions'
import type { LocalizedText } from '@/lib/localized-text'

/*
 * CONTRATO DA API (tipos). O servidor simulado (src/mocks) e a API real devolvem
 * exatamente estes formatos. Datas: ISO 8601; dias sem hora: "yyyy-mm-dd".
 */

/* ------------------------------------------------------------ comuns */

export interface Mudanca {
  /** Chave do campo (traduzida na tela). */
  campo: string
  antes: string | number | boolean | null
  depois: string | number | boolean | null
}

export interface EventoHistorico {
  id: string
  autor: string
  em: string
  acao:
    | 'criado'
    | 'editado'
    | 'status'
    | 'site_criado'
    | 'site_editado'
    | 'site_removido'
    | 'documento_adicionado'
    | 'documento_removido'
    | 'ocorrencia_registrada'
    | 'ocorrencia_editada'
    | 'ocorrencia_cancelada'
    | 'recebido'
    | 'recebimento_editado'
  mudancas?: Mudanca[]
  nota?: string
}

/* ------------------------------------------------------------ Admin › Usuários */

export type UsuarioStatus = 'ativo' | 'bloqueado' | 'inativo'

/** Perfil de acesso do usuário (mesmos papéis de src/config/permissions.ts). */
export type UsuarioPerfil = Role

/** Ações do fluxo de status do usuário. */
export type AcaoUsuario = 'bloquear' | 'desbloquear' | 'inativar' | 'reativar'

/** Linha da lista (resumo). */
export interface UsuarioResumo {
  id: string
  codigo: string
  nome: string
  email: string
  perfil: UsuarioPerfil
  status: UsuarioStatus
  /** Último acesso ao sistema (null = nunca acessou). */
  ultimoAcesso: string | null
  criadoEm: string
}

export interface Usuario extends UsuarioResumo {
  criadoPor: string
  alteradoPor: string
  alteradoEm: string
  historico: EventoHistorico[]
  /** Ações que o fluxo permite agora (a tela ainda confere a permissão do perfil). */
  acoesPermitidas: AcaoUsuario[]
}

/** Dados enviados ao criar/editar. */
export interface UsuarioInput {
  nome: string
  email: string
  perfil: UsuarioPerfil
}

export interface UsuariosResumo {
  total: number
  ativos: number
  bloqueados: number
  inativos: number
}

/** Página da lista em modo servidor + contagens por valor dos filtros. */
export type PaginaUsuarios = TablePage<UsuarioResumo> & {
  facets: Record<string, Record<string, number>>
}

/* ------------------------------------------------------------ Clientes */

export type ClienteStatus = 'ativo' | 'inativo'

/** Ações do fluxo de status do cliente. */
export type AcaoCliente = 'inativar' | 'reativar'

/** Contato do cliente. Telefone só com dígitos (DDD + número). */
export interface ContatoCliente {
  id: string
  nome: string | null
  email: string
  telefone: string
  principal: boolean
}

/** Linha da lista (resumo) — com o contato principal. CNPJ sem pontuação. */
export interface ClienteResumo {
  id: string
  codigo: string
  nome: string
  cnpj: string
  /** SLA: prazo máximo (dias) da chegada na Re-Teck até o COD. */
  slaDias: number | null
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  /** Quantidade de contatos. */
  contatos: number
  status: ClienteStatus
  criadoEm: string
}

export interface Cliente {
  id: string
  codigo: string
  nome: string
  cnpj: string
  slaDias: number | null
  status: ClienteStatus
  /** O principal vem primeiro. */
  contatos: ContatoCliente[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  /** Ações que o fluxo permite agora (a tela ainda confere a permissão do perfil). */
  acoesPermitidas: AcaoCliente[]
}

/**
 * Dados enviados ao criar/editar. Exatamente um contato com `principal: true`.
 * Contato com `id` = já existente (mantém o vínculo, ex.: responsável por um site).
 */
export interface ClienteInput {
  nome: string
  cnpj: string
  slaDias: number | null
  contatos: {
    id: string | null
    nome: string | null
    email: string
    telefone: string
    principal: boolean
  }[]
}

export interface ClientesResumo {
  total: number
  ativos: number
  inativos: number
}

export type PaginaClientes = TablePage<ClienteResumo> & {
  facets: Record<string, Record<string, number>>
}

/** Doca de um site. Medidas em metros (m) e metros quadrados (m²). */
export interface Doca {
  id: string
  numero: string
  alturaMaxCaminhao: number
  comprimentoMaxCaminhao: number | null
  dockLeveler: boolean
  tailLift: boolean
  areaLift: number | null
  espaco: number | null
  altura: number | null
  voltagemShredder: number | null
  pisoProtecaoObrigatorio: boolean
}

/** Site do cliente (Logística). CEP só com dígitos. */
export interface SiteCliente {
  id: string
  codigo: string
  regiao: string | null
  horario: string | null
  totalGaylords: number | null
  cep: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  shredderProprio: boolean
  edgeSite: boolean
  /** Contato do cliente responsável pelo site (null = sem responsável). */
  responsavel: ContatoCliente | null
  docas: Doca[]
  criadoEm: string
  alteradoEm: string
}

/**
 * Criar/editar site. Responsável: contato existente (`contatoId`) OU contato novo
 * (`novoContato`, que entra também na lista de contatos do cliente) OU nenhum.
 */
export interface SiteInput {
  codigo: string
  regiao: string | null
  horario: string | null
  totalGaylords: number | null
  cep: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  shredderProprio: boolean
  edgeSite: boolean
  contatoId: string | null
  novoContato: { nome: string | null; email: string; telefone: string } | null
  docas: Omit<Doca, 'id'>[]
}

export type TipoDocumento = 'contrato' | 'fiscal' | 'licenca' | 'outro'

export interface DocumentoCliente {
  id: string
  tipo: TipoDocumento
  nome: string
  extensao: string
  /** Bytes. */
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/**
 * Resumo dos lotes do cliente (Visão geral). Os lotes vêm dos sistemas de produção:
 * enquanto `conectado` for false, a tela mostra "sem dados".
 */
export interface LotesResumoCliente {
  conectado: boolean
  aChegar: number
  emOperacao: number
  finalizados: number
  /** Últimos lotes com atualização (até 5). */
  ultimos: { id: string; codigo: string; status: string; atualizadoEm: string }[]
}

/** CEP → endereço (ViaCEP, pelo servidor). */
export interface EnderecoCep {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  regiao: string
  endereco: string
}

/** Endereço → coordenadas (mapa, pelo servidor). */
export interface Coordenadas {
  latitude: number
  longitude: number
  descricao: string
  /** `cidade` = só achou a cidade: ponto aproximado, pedir para ajustar o pino. */
  precisao: 'endereco' | 'cidade'
}

/* ------------------------------------------------------------ Relacionamento */

/** Cadastros simples: ativo ⇄ inativo (não se exclui; o histórico fica). */
export type StatusCadastro = 'ativo' | 'inativo'
export type AcaoCadastro = 'inativar' | 'reativar'

export interface ResumoCadastro {
  total: number
  ativos: number
  inativos: number
}

/* ---------------- motoristas */

export interface MotoristaResumo {
  id: string
  codigo: string
  nome: string
  /** Só dígitos. */
  cpf: string
  /** Só dígitos. */
  telefone: string
  transportadoraId: string | null
  transportadoraNome: string | null
  status: StatusCadastro
  criadoEm: string
}

export interface Motorista extends MotoristaResumo {
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

/** Transportadora: existente (`transportadoraId`), nova (`novaTransportadora`) ou nenhuma. */
export interface MotoristaInput {
  nome: string
  cpf: string
  telefone: string
  transportadoraId: string | null
  novaTransportadora: { nome: string; cnpj: string } | null
}

export type PaginaMotoristas = TablePage<MotoristaResumo> & {
  facets: Record<string, Record<string, number>>
}

export type ResumoMotoristas = ResumoCadastro & { semTransportadora: number }

/* ---------------- transportadoras */

export interface ContatoTransportadora {
  id: string
  nome: string | null
  email: string
  telefone: string
  principal: boolean
}

export interface TransportadoraResumo {
  id: string
  codigo: string
  nome: string
  cnpj: string
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  contatos: number
  /** Quantidade de motoristas vinculados. */
  motoristas: number
  status: StatusCadastro
  criadoEm: string
}

export interface Transportadora {
  id: string
  codigo: string
  nome: string
  cnpj: string
  status: StatusCadastro
  /** O principal vem primeiro. Pode ser vazio. */
  contatos: ContatoTransportadora[]
  motoristas: MotoristaResumo[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

/**
 * Criar/editar. Contatos opcionais (se houver, exatamente um principal). Motoristas vinculados:
 * existentes (`id`) ou novos (`novo`); os que saírem da lista ficam sem transportadora.
 */
export interface TransportadoraInput {
  nome: string
  cnpj: string
  contatos: {
    id: string | null
    nome: string | null
    email: string
    telefone: string
    principal: boolean
  }[]
  motoristas: ({ id: string } | { novo: { nome: string; cpf: string; telefone: string } })[]
}

export interface TransportadoraOpcao {
  id: string
  nome: string
  cnpj: string
  status: StatusCadastro
}

export type PaginaTransportadoras = TablePage<TransportadoraResumo> & {
  facets: Record<string, Record<string, number>>
}

/* ---------------- veículos */

export type TipoVeiculo = 'truck' | 'carreta' | 'van'

export interface Veiculo {
  id: string
  codigo: string
  tipo: TipoVeiculo
  /** Quantidade de volumes (pallets + gaylords + racks): faixa usada no cálculo da OS. */
  volumeMinimo: number | null
  /** Quantidade de volumes. */
  volumeMaximo: number | null
  /** metros */
  comprimento: number | null
  /** metros */
  largura: number | null
  /** Quantidade de pallets. */
  capacidadePallets: number | null
  /** Toneladas. */
  capacidadeToneladas: number | null
  status: StatusCadastro
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface VeiculoDetalhe extends Veiculo {
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

export type VeiculoInput = Pick<
  Veiculo,
  | 'tipo'
  | 'volumeMinimo'
  | 'volumeMaximo'
  | 'comprimento'
  | 'largura'
  | 'capacidadePallets'
  | 'capacidadeToneladas'
>

export type PaginaVeiculos = TablePage<Veiculo> & {
  facets: Record<string, Record<string, number>>
}

/* ------------------------------------------------------------ ordens (agendamento / lotes) */

/** Etapas do lote: agendado → inspeção (recebido) → processo → aguardando COD → concluído. */
export type StatusOrdem = 'agendado' | 'inspecao' | 'processo' | 'aguardando_cod' | 'concluido'
/** escopo/observacoes = enviados no agendamento; lote = adicionados depois (aba Documentos). */
export type SecaoAnexo = 'escopo' | 'observacoes' | 'lote'

export interface ServicosOs {
  psm: boolean
  onsiteShredding: boolean
  recycleOnly: boolean
  valueRecoveryRacks: boolean
  valueRecoveryItad: boolean
}

export interface QuantidadesOs {
  boxes: number | null
  pallets: number | null
  gaylords: number | null
  racks: number | null
  /** Só com Value Recovery (Racks). */
  placasPolicarbonato: number | null
  requerPalletsVazios: boolean
  /** Só quando requer pallets vazios. */
  palletsVazios: number | null
  itensMais25kg: boolean
  fatorLimitante: string | null
}

export type AvisoCalculo =
  | { codigo: 'sem_servico' }
  | { codigo: 'nenhum_cabe'; tipo: string; comprimentoMax: number | null }
  | { codigo: 'rebaixado'; desejado: string; final: string }

/** Pré-cálculo da OS (o que levar, caminhão, viagens, pessoas). */
export interface CalculoOs {
  totalVolumes: number
  volumesEfetivos: number
  veiculo: { tipo: string; comprimento: number | null; capacidade: number }
  caminhaoPlataforma: boolean
  viagens: number
  levarShredder: boolean
  levarGaylordReteck: boolean
  levarPalletsVazios: boolean
  qtdPalletsVazios: number
  totalPessoas: number
  avisos: AvisoCalculo[]
}

/** Tipos de documento do lote. */
export type TipoDocumentoLote = 'escopo' | 'nota_fiscal' | 'mtr' | 'cdf' | 'foto' | 'outro'

export interface AnexoOrdem {
  id: string
  secao: SecaoAnexo
  tipo: TipoDocumentoLote
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/** Lote agendado (linha da lista). Datas: início do dia (ISO UTC). */
export interface OrdemResumo {
  id: string
  codigo: string
  status: StatusOrdem
  clienteId: string
  clienteNome: string
  siteCodigo: string
  docaNumero: string
  transportadoraNome: string | null
  referenciaCliente: string | null
  dataColeta: string
  coletaPrevista: string | null
  dataChegada: string | null
  rastrear: boolean
  motoristaNome: string | null
  placa: string | null
  servicos: ServicosOs
  totalVolumes: number
  /** Chegada na Re-Teck (início do SLA). */
  recebidoEm: string | null
  etapaDesde: string | null
  codEmitidoEm: string | null
  criadoEm: string
}

export interface Ordem extends OrdemResumo {
  siteId: string
  docaId: string
  transportadoraId: string | null
  motoristaId: string | null
  quantidades: QuantidadesOs
  escopo: string | null
  observacoes: string | null
  anexos: AnexoOrdem[]
  calculo: CalculoOs | null
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
  /** Linha do tempo: etapas por onde o lote passou (a primeira é "agendado"). */
  etapas: EtapaLote[]
  /** Pallets recebidos (integração / Operação › Recebimento). */
  pallets: PalletLote[]
  /** Ocorrências (mais recente primeiro). */
  ocorrencias: OcorrenciaLote[]
  /** Recebimento (Operação › Recebimento); null = ainda não recebido. */
  recebimento: RecebimentoLote | null
}

/* ---------------- Recebimento (server/src/modules/ordens/ordens.recebimento.ts) */

export type InspecaoVisual = 'bom' | 'avaria' | 'outro'

export interface ItemRecebimento {
  id: string
  numero: string
  fotos: FotoRecebimento[]
}

export interface RecebimentoLote {
  /** Início do dia (ISO). */
  dataRecebimento: string
  inspecao: InspecaoVisual
  inspecaoDescricao: LocalizedText | null
  /** Ocorrência criada para avaria/outro. */
  ocorrenciaId: string | null
  lacres: ItemRecebimento[]
  notas: ItemRecebimento[]
  fotosGerais: FotoRecebimento[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Recebimento enviado (vai como `dados` no multipart; fotos novas por campo). */
export interface RecebimentoInput {
  /** AAAA-MM-DD */
  dataRecebimento: string
  inspecao: InspecaoVisual
  inspecaoDescricao: LocalizedText | null
  lacres: { id?: string; numero: string; fotosManter: string[] }[]
  notas: { id?: string; numero: string; fotosManter: string[] }[]
  pallets: {
    id?: string
    pesoBruto: number
    tara: number | null
    conteudo: string | null
    fotosManter: string[]
  }[]
  fotosGeraisManter: string[]
}

/** Fotos novas do recebimento: `lacres.<i>`, `notas.<i>`, `pallets.<i>` e `gerais`. */
export type FotosRecebimento = Record<string, File[]>

/* ---------------- Detalhe do lote (server/src/modules/ordens/ordens.lote.ts) */

export interface EtapaLote {
  etapa: StatusOrdem
  /** Quando o lote entrou na etapa. */
  em: string
}

/** Foto do recebimento (lacre, nota fiscal, pallet ou geral). */
export interface FotoRecebimento {
  id: string
  nome: string
  extensao: string
  tamanho: number
}

export interface PalletLote {
  id: string
  numero: number
  /** Peso bruto (kg). */
  pesoKg: number | null
  /** Tara — peso do pallet vazio (kg). */
  taraKg: number | null
  /** Bruto − tara (kg). */
  pesoLiquidoKg: number | null
  /** Fotos do recebimento. */
  fotos: FotoRecebimento[]
  conteudo: string | null
  pesadoPor: string | null
  pesadoEm: string | null
  temFoto: boolean
  /** Sistema de onde veio o registro (ex.: "iERP"). */
  origem: string
}

export type MomentoOcorrencia = 'coleta' | 'trajeto' | 'recebimento'
export type CategoriaOcorrencia =
  | 'atraso'
  | 'avaria_carga'
  | 'divergencia_quantidade'
  | 'embalagem_inadequada'
  | 'problema_veiculo'
  | 'acesso_negado'
  | 'material_nao_identificado'
  | 'outro'
export type StatusOcorrencia = 'registrada' | 'cancelado'

export interface FotoOcorrencia {
  id: string
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

export interface OcorrenciaLote {
  id: string
  /** Sequencial dentro do lote (#1, #2…). */
  numero: number
  momento: MomentoOcorrencia
  categoria: CategoriaOcorrencia
  /** Texto nos 3 idiomas (traduzido ao salvar). */
  texto: LocalizedText
  status: StatusOcorrencia
  fotos: FotoOcorrencia[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Registro/correção de ocorrência (vai como `dados` no multipart, com as `fotos`). */
export interface OcorrenciaInput {
  momento: MomentoOcorrencia
  categoria: CategoriaOcorrencia
  texto: LocalizedText
  /** Só na correção: ids das fotos a remover. */
  removerFotos?: string[]
}

/** Nova ordem (vai como `dados` no multipart, com os arquivos de escopo e observações). */
export interface OrdemInput {
  clienteId: string
  siteId: string
  docaId: string
  transportadoraId: string | null
  referenciaCliente: string | null
  /** yyyy-mm-dd (obrigatória) */
  dataColeta: string
  coletaPrevista: string | null
  dataChegada: string | null
  rastrear: boolean
  motoristaId: string | null
  /** Sem pontuação. */
  placa: string | null
  servicos: ServicosOs
  quantidades: QuantidadesOs
  escopo: string | null
  observacoes: string | null
}

export type PaginaOrdens = TablePage<OrdemResumo> & {
  facets: Record<string, Record<string, number>>
}

/* ------------------------------------------------------------ dashboard da operação */

export interface EtapasContagem {
  inspecao: number
  processo: number
  aguardandoCod: number
}

export type SituacaoSla = 'atrasado' | 'no_prazo' | 'sem_sla'

export type AnomaliaPrazo = { tipo: 'atrasado'; dias: number } | { tipo: 'risco'; uso: number }

/** GET /api/dashboard/operacao (datas `yyyy-mm-dd`; instantes em ISO UTC). */
export interface DashboardOperacao {
  atualizadoEm: string
  hoje: string
  cards: {
    chegadasPrevistas7d: number
    emProcesso: EtapasContagem & { total: number }
    slaVencido: number
    slaEmRisco: number
    /** 0..1; null = sem lote fechado com SLA em 30 dias. */
    cumprimentoSla30d: number | null
    codPendente: number
  }
  forecast: {
    dia: string
    lotes: {
      id: string
      codigo: string
      clienteNome: string
      siteCodigo: string
      pallets: number
      gaylords: number
      racks: number
      boxes: number
    }[]
  }[]
  mapa: {
    de: string
    ate: string
    clienteEncontrado: boolean
    pontos: {
      siteId: string
      clienteId: string
      siteCodigo: string
      endereco: string | null
      latitude: number
      longitude: number
      coletas: number
    }[]
    semLocalizacao: { siteId: string; clienteId: string; siteCodigo: string }[]
  }
  porCliente: {
    clienteId: string
    clienteNome: string
    slaDias: number | null
    emProcesso: number
    etapas: EtapasContagem
    diasDecorridos: number | null
    emRisco: number
    atrasados: number
    slaCumprido30d: number | null
    situacao: SituacaoSla
  }[]
  lotes: {
    id: string
    codigo: string
    clienteId: string
    clienteNome: string
    etapa: StatusOrdem
    recebidoEm: string | null
    etapaDesde: string | null
    diasNaEtapa: number | null
    diasDecorridos: number | null
    slaDias: number | null
    restante: number | null
    anomalias: AnomaliaPrazo[]
  }[]
}

/* ------------------------------------------------------------ shell (busca e notificações) */

export interface ResultadoBusca {
  tipo: 'cliente' | 'transportadora' | 'motorista' | 'usuario'
  id: string
  codigo: string
  titulo: string
  rota: string
}

export interface Notificacao {
  id: string
  tipo: 'usuario_criado' | 'usuario_bloqueado'
  parametros: Record<string, string | number>
  tom: 'info' | 'success' | 'warning' | 'alert' | 'danger' | 'inactive'
  em: string
  lida: boolean
  rota?: string
}
