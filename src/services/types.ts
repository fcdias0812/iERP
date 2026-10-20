import type { TablePage } from '@/components/data-table/types'
import type { NivelAcesso } from '@/config/permissions'
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
    | 'processamento'
    | 'devolucao_pedida'
    | 'devolucao_cancelada'
    | 'chave_gerada'
    | 'chave_trocada'
    | 'chave_revogada'
  mudancas?: Mudanca[]
  nota?: string
}

/* ------------------------------------------------------------ Admin › Usuários */

export type UsuarioStatus = 'ativo' | 'bloqueado' | 'inativo'

/** Id do perfil de acesso (Administração › Perfis de acesso). */
export type UsuarioPerfil = string

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
/** Região do Brasil (código; a tela traduz em `clientes.sites.regioes.*`). */
export type RegiaoBrasil = 'norte' | 'nordeste' | 'centro_oeste' | 'sudeste' | 'sul'

export interface SiteCliente {
  id: string
  codigo: string
  regiao: RegiaoBrasil | null
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
  regiao: RegiaoBrasil | null
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
  /** Código da região (pelo nome do ViaCEP ou pela UF). */
  regiao: RegiaoBrasil | null
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

/**
 * Etapas do lote: agendado → inspeção (recebido) → processo → aguardando COD → concluído. Fora do
 * fluxo, cancelado (lote de outro sistema cancelado lá — Gerenciamento de Projetos).
 */
export type StatusOrdem =
  'agendado' | 'inspecao' | 'processo' | 'aguardando_cod' | 'concluido' | 'cancelado'
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
  /** Data de coleta CONFIRMADA (null = só a prevista). */
  dataColeta: string | null
  coletaPrevista: string
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
  /** Andamento num sistema de fora (MoonShot): "Processamento 2/4 · Leitura das peças". */
  processamento: ProcessamentoExterno | null
  /** O sistema de fora pediu a correção do recebimento (null = nada pendente). */
  devolucao: DevolucaoAoRecebimento | null
  /** Lote que nasceu num sistema de fora e só é alterado lá (null = agendado aqui). */
  externo: LoteExterno | null
}

/** De onde o lote veio (Gerenciamento de Projetos — só para ver aqui). */
export interface LoteExterno {
  /** Código do sistema (GERENCIAMENTO). */
  sistema: string
  /** Tela da ordem no sistema de fora. */
  url: string | null
}

/** O que o sistema de onde o lote veio disse da ordem (server/src/modules/integracao/gerenciamento.ts). */
export interface DadosExternos {
  numero: string | null
  lote: string | null
  cliente: string | null
  site: string | null
  doca: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  pais: string | null
  transportadora: string | null
  observacoes: string | null
  pedidoEm: string | null
  coletaAgendadaEm: string | null
  coletaPrevistaEm: string | null
  chegadaEm: string | null
  previstoPesoKg: number | null
  previstoPallets: number | null
  previstoUnidades: number | null
  codNumero: string | null
  codEm: string | null
  /** Encerrada lá sem COD registrado. */
  semCod: boolean
  etapas: { nome: string; desde: string | null; estado: string | null }[]
}

/** O que aconteceu lá — pesagens com foto, documentos e materiais (ao vivo, ao abrir o lote). */
export interface EspelhoExterno {
  sistema: string
  url: string | null
  declarado: { pesoKg: number | null; pallets: number | null }
  pesado: { pesoKg: number; pallets: number; pesagens: number; fotos: number } | null
  pesagens: {
    id: string
    pesoKg: number | null
    pallets: number | null
    conteudo: string | null
    pesadoPor: string | null
    pesadoEm: string | null
    fotoUrl: string | null
  }[]
  /** null = o sistema não compartilha os arquivos (o anexo de lá exige o login de lá). */
  arquivos:
    | {
        id: string
        tipo: string | null
        nome: string
        enviadoPor: string | null
        enviadoEm: string | null
        url: string | null
      }[]
    | null
  materiais: {
    tipo: string | null
    descricao: string | null
    embalagem: string | null
    pesoKg: number | null
  }[]
  notas: { autor: string | null; data: string | null; texto: string }[]
  seriais: number
  /** O sistema registra pesagens? (o Gerenciamento sim; o MSDC não). */
  temPesagens: boolean
  /** Resumo do que aconteceu lá, como ele escreve (MSDC: etapa, racks, máquinas, peças). */
  resumo: { rotulo: string; valor: string; detalhe: string | null }[]
}

export interface ProcessamentoExterno {
  /** Código do sistema (MOONSHOT). */
  sistema: string
  etapa: string | null
  indice: number | null
  total: number | null
  desde: string | null
  /** Tela do lote no sistema de fora. */
  url: string | null
  atualizadoEm: string | null
}

export interface DevolucaoAoRecebimento {
  motivo: string | null
  pedidoPor: string | null
  em: string
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
  /** Balanço de massa mandado pelo sistema de fora (MoonShot); null = ainda nenhum. */
  balanco: BalancoDeMassa | null
  /** O que o sistema de onde o lote veio disse da ordem (só para mostrar). */
  externoDados: DadosExternos | null
}

/* ---------------- Balanço de massa (server/src/modules/integracao/balanco.ts) */

/** aguardando = sem bruto/embalagem; parcial = lote ainda não concluído. */
export type SituacaoBalanco = 'aguardando' | 'parcial' | 'fechado' | 'fora'

export interface CommodityBalanco {
  codigo: string
  rotulo: string
  pesoKg: number
}

export interface ContainerBalanco {
  codigo: string
  categoria: string | null
  categoriaRotulo: string | null
  /** aberto | fechado | embarcado */
  situacao: string
  brutoKg: number | null
  taraKg: number | null
  /** Peso DESTE lote no container (o bigbag junta vários lotes). */
  desteLoteKg: number
  destino: string | null
  fechadoEm: string | null
  embarcadoEm: string | null
}

export interface BalancoDeMassa {
  sistema: string
  recebidoEm: string
  brutoKg: number | null
  embalagemKg: number | null
  lidoKg: number | null
  scrapRecebidoKg: number | null
  scrapTriadoKg: number | null
  toleranciaPercent: number | null
  pecasLidas: number
  pecasSemPeso: number
  foraDaLista: number
  liquidoKg: number | null
  contabilizadoKg: number | null
  diferencaKg: number | null
  diferencaPercent: number | null
  situacao: SituacaoBalanco
  commodities: CommodityBalanco[]
  containers: ContainerBalanco[]
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
  /** yyyy-mm-dd — a confirmada (opcional) */
  dataColeta: string | null
  /** yyyy-mm-dd (obrigatória) */
  coletaPrevista: string
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
      /** Data de coleta confirmada? (senão, só prevista: borda tracejada) */
      confirmada: boolean
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
      /** Cidade do endereço (null = a tela mostra o código do site). */
      cidade: string | null
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

/** Tipos de registro da busca global (Ctrl+K) — server/src/modules/sistema/busca.ts. */
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
  /** Vazio quando o registro não tem código (material, área, perfil). */
  codigo: string
  titulo: string
  /** Nome nos 3 idiomas (materiais e perfis). */
  tituloTraduzido?: LocalizedText
  /** Informação extra curta (cidade do site, site do lote, posição do caixote…). */
  detalhe?: string | null
  /** Registro "pai" (o cliente do site). */
  paiId?: string
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

/* ---------------- Histórico do módulo (server/src/modules/historico/historico.ts) */

export type ModuloHistorico = 'ordens' | 'operacao'

/** Evento do histórico do módulo: o evento + o registro (lote) e o cliente. */
export interface EventoHistoricoModulo extends EventoHistorico {
  registroId: string
  registroCodigo: string
  clienteNome: string
}

/* ---------------- Sistema › Cadastros (server/src/modules/cadastros/cadastros.ts) */

interface ControleCadastro {
  id: string
  status: StatusCadastro
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}
interface ComHistoricoCadastro {
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}

export interface Material extends ControleCadastro {
  /** Nome nos 3 idiomas. */
  nome: LocalizedText
  /** Quantos recipientes guardam este material. */
  recipientes: number
}
export type MaterialDetalhe = Material & ComHistoricoCadastro
export interface MaterialInput {
  nome: LocalizedText
}

export interface AreaEstoque extends ControleCadastro {
  nome: string
  descricao: LocalizedText | null
  recipientes: number
}
export type AreaEstoqueDetalhe = AreaEstoque & ComHistoricoCadastro
export interface AreaEstoqueInput {
  nome: string
  descricao: LocalizedText | null
}

export type TipoRecipiente = 'caixote' | 'pallet'
export interface Recipiente extends ControleCadastro {
  tipo: TipoRecipiente
  /** CXT-20260001 / PLT-20260001 */
  codigo: string
  materialId: string
  materialNome: LocalizedText
  areaId: string
  areaNome: string
  posicao: string
  /** kg */
  taraKg: number
}
export type RecipienteDetalhe = Recipiente & ComHistoricoCadastro
export interface RecipienteInput {
  tipo: TipoRecipiente
  materialId: string
  taraKg: number
  areaId: string
  posicao: string
}

/* ---------------- Administração › Perfis de acesso e Auditoria */

export interface PerfilAcesso {
  id: string
  nome: LocalizedText
  descricao: LocalizedText | null
  /** Administrador: pode tudo, não muda. */
  fixo: boolean
  /** Página do menu → nível; ausente = sem acesso. */
  permissoes: Partial<Record<string, NivelAcesso>>
  /** Usuários com este perfil. */
  usuarios: number
  status: StatusCadastro
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}
export type PerfilAcessoDetalhe = PerfilAcesso & {
  historico: EventoHistorico[]
  acoesPermitidas: AcaoCadastro[]
}
export interface PerfilAcessoInput {
  nome: LocalizedText
  descricao: LocalizedText | null
  /** Página → nível (null = sem acesso). */
  permissoes: Record<string, NivelAcesso | null>
}

export type TipoRegistroAuditoria =
  | 'usuario'
  | 'perfil'
  | 'cliente'
  | 'transportadora'
  | 'motorista'
  | 'veiculo'
  | 'ordem'
  | 'material'
  | 'area'
  | 'recipiente'
  | 'integracao'

/** Evento da Auditoria: o evento + o registro (tipo, id e nome/código). */
export interface EventoAuditoria extends EventoHistorico {
  tipo: TipoRegistroAuditoria
  registroId: string
  registroRotulo: string
  /** Caixote ou pallet (recipientes). */
  registroSubtipo: string | null
}

/* ---------------- Administração › Integração (server/src/modules/integracao/integracao.ts) */

/** processamento: os lotes daqui vão para ele (MoonShot); origem: os lotes vêm dele (Gerenciamento). */
export type TipoSistema = 'processamento' | 'origem'

/** Resumo da última leitura de um sistema de origem. */
export interface ResumoSincronizacao {
  em: string
  coletas: number
  ligadas: number
  criados: number
  pendencias: {
    cliente: string
    coletas: number
    motivo: 'sem_cliente' | 'varios_clientes' | 'cliente_inativo'
  }[]
  /** Coletas que deram erro na última leitura (tentam de novo na próxima). */
  falhas: { coleta: string; erro: string }[]
  /** Lotes cuja coleta não vem mais no painel de lá (excluída, ou fora do Brasil). */
  sumidos: { codigo: string; referencia: string | null }[]
  cargaCompletaEm: string | null
}

export interface Integracao {
  id: string
  /** Código do sistema (MOONSHOT): vai no `destino` dos pallets do contrato. */
  sistema: string
  tipo: TipoSistema
  nome: string
  /** Começo da chave, para reconhecer (null = sem chave). */
  chavePrefixo: string | null
  chaveCriadaEm: string | null
  urlAvisos: string | null
  urlPainel: string | null
  /** Certificado PÚBLICO (PEM) da CA do sistema, se ele serve HTTPS com CA própria. */
  caPainel: string | null
  temTokenPainel: boolean
  status: 'ativo' | 'inativo'
  ultimoUsoEm: string | null
  ultimoAvisoEm: string | null
  ultimoPainelEm: string | null
  ultimoErro: string | null
  ultimoErroEm: string | null
  avisosPendentes: number
  sincronizacao: ResumoSincronizacao | null
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}
export interface AvisoIntegracao {
  id: string
  codigo: string
  evento: string
  tentativas: number
  erro: string | null
  criadoEm: string
  enviadoEm: string | null
}
export interface IntegracaoDetalhe extends Integracao {
  historico: EventoHistorico[]
  avisos: AvisoIntegracao[]
  acoesPermitidas: AcaoCadastro[]
}
export interface IntegracaoInput {
  sistema?: string
  nome: string
  urlAvisos: string | null
  urlPainel: string | null
  /** Ausente = mantém o guardado; '' = apaga. */
  tokenPainel?: string
  /** Certificado da CA (PEM); '' = apaga. */
  caPainel?: string
}
/** Sistemas que podem ser integrados (por cliente: Dell → MOONSHOT). */
export interface SistemaIntegravel {
  sistema: string
  nome: string
  tipo: TipoSistema
}
