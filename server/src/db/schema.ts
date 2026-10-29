/*
 * Tipos das tabelas para o Kysely (nomes em camelCase no código; o CamelCasePlugin
 * converte para snake_case no banco).
 *
 * Convenções PORTÁVEIS (SQLite hoje, PostgreSQL depois):
 *  - datas/horas: texto ISO 8601 em UTC (`new Date().toISOString()`);
 *  - sim/não: inteiro 0/1;
 *  - listas/objetos: texto JSON;
 *  - ids: texto (UUID).
 */

import type { Generated } from 'kysely'

export interface UsuariosTable {
  id: string
  /** Sequencial que gera o código (USR-00001). */
  numero: number
  codigo: string
  nome: string
  /** Sempre em minúsculas (único). */
  email: string
  perfil: string
  status: string
  ultimoAcesso: string | null
  /** Nome + e-mail + código sem acento e em minúsculas (busca geral). */
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface UsuariosHistoricoTable {
  id: string
  usuarioId: string
  autor: string
  em: string
  acao: string
  /** JSON: [{ campo, antes, depois }]. */
  mudancas: string | null
  nota: string | null
}

export interface ClientesTable {
  id: string
  /** Sequencial que gera o código (CLI-00001). */
  numero: number
  codigo: string
  nome: string
  /** Sem pontuação, maiúsculas (CNPJ alfanumérico). Único. */
  cnpj: string
  status: string
  /** Nome, CNPJ, código e contatos sem acento e em minúsculas (busca geral). */
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  /** SLA: prazo máximo (dias) da chegada na Re-Teck até o COD. */
  slaDias: number | null
  /* Configurações (aba Configurações do cliente; sim/não = 0/1). */
  /** Toda coleta nasce com rastreio. */
  rastrearColeta: Generated<number>
  /** Quem agenda pode mudar o rastreio só daquela coleta. */
  rastreioExcecao: Generated<number>
  /** Coleta rastreada só com motorista e placa. */
  exigirMotoristaPlaca: Generated<number>
  /** Serviços já marcados no agendamento (JSON de ServicosOs; null = o padrão do sistema). */
  servicosPadrao: string | null
  transportadoraPadraoId: string | null
  /** Instruções do cliente (LocalizedText JSON). */
  instrucoes: string | null
  /** Agendamento só com a planilha de escopo (.xlsx). */
  exigirEscopoPlanilha: Generated<number>
  exigirLacre: Generated<number>
  exigirNota: Generated<number>
  exigirTara: Generated<number>
  exigirFotosGerais: Generated<number>
  /** Sistema que processa os lotes (MOONSHOT); null = processado aqui. */
  sistemaProcessamento: string | null
  /** Dias na mesma etapa até virar anomalia no Dashboard. */
  diasParadoEtapa: number | null
  /** Antecedência mínima (dias) do agendamento — só avisa. */
  antecedenciaDias: number | null
  agendamentoBloqueado: Generated<number>
  bloqueioMotivo: string | null
  /** Código do link público de acompanhamento (48 hex); null = sem link. */
  rastreioToken: string | null
}

export interface ClientesContatosTable {
  id: string
  clienteId: string
  nome: string | null
  email: string
  /** Só dígitos (DDD + número). */
  telefone: string
  /** 0/1 — um principal por cliente. */
  principal: number
  ordem: number
}

export type ClientesHistoricoTable = Omit<UsuariosHistoricoTable, 'usuarioId'> & {
  clienteId: string
}

/** View `clientes_lista`: cliente + contato principal + quantidade de contatos (só leitura). */
export interface ClientesListaView extends ClientesTable {
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  contatos: number
}

export interface ClientesSitesTable {
  id: string
  clienteId: string
  codigo: string
  regiao: string | null
  horario: string | null
  totalGaylords: number | null
  /** Só dígitos. */
  cep: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  /** 0/1 */
  shredderProprio: number
  /** 0/1 */
  edgeSite: number
  contatoResponsavelId: string | null
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface ClientesDocasTable {
  id: string
  siteId: string
  numero: string
  /** Metros. */
  alturaMaxCaminhao: number
  comprimentoMaxCaminhao: number | null
  /** 0/1 */
  dockLeveler: number
  /** 0/1 */
  tailLift: number
  /** m² */
  areaLift: number | null
  /** m² */
  espaco: number | null
  /** Metros. */
  altura: number | null
  /** Volts. */
  voltagemShredder: number | null
  /** 0/1 */
  pisoProtecaoObrigatorio: number
  ordem: number
}

export interface ClientesDocumentosTable {
  id: string
  clienteId: string
  tipo: string
  /** Nome original (exibido). O arquivo em disco usa o id. */
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/** Histórico único (transportadoras, motoristas, veículos). */
export interface HistoricoTable {
  id: string
  entidade: string
  registroId: string
  autor: string
  em: string
  acao: string
  mudancas: string | null
  nota: string | null
}

/** Colunas de controle de todo cadastro. */
interface Controle {
  id: string
  numero: number
  codigo: string
  status: string
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface TransportadorasTable extends Controle {
  nome: string
  /** Sem pontuação, maiúsculas. Único. */
  cnpj: string
}

export interface TransportadorasContatosTable {
  id: string
  transportadoraId: string
  nome: string | null
  email: string
  telefone: string
  principal: number
  ordem: number
}

export interface TransportadorasListaView extends TransportadorasTable {
  contatoNome: string | null
  contatoEmail: string | null
  contatoTelefone: string | null
  contatos: number
  motoristas: number
}

export interface MotoristasTable extends Controle {
  nome: string
  /** Só dígitos. Único. */
  cpf: string
  /** Só dígitos. */
  telefone: string
  transportadoraId: string | null
}

export interface MotoristasListaView extends MotoristasTable {
  transportadoraNome: string | null
}

export interface VeiculosTable extends Controle {
  tipo: string
  /** Quantidade de volumes (pallets + gaylords + racks) — faixa usada no cálculo da OS. */
  volumeMinimo: number | null
  /** Quantidade de volumes. */
  volumeMaximo: number | null
  /** metros */
  comprimento: number | null
  /** metros */
  largura: number | null
  /** Quantidade de pallets. */
  capacidadePallets: number | null
  /** toneladas */
  capacidadeToneladas: number | null
}

/** Ordem = lote agendado. Sim/não em 0/1; datas como início do dia (ISO UTC). */
export interface OrdensTable extends Controle {
  clienteId: string
  siteId: string
  docaId: string
  transportadoraId: string | null
  referenciaCliente: string | null
  /** Data de coleta CONFIRMADA (opcional). */
  dataColeta: string | null
  /** Coleta prevista (obrigatória). */
  coletaPrevista: string
  dataChegada: string | null
  rastrear: number
  motoristaId: string | null
  placa: string | null
  psm: number
  onsiteShredding: number
  recycleOnly: number
  valueRecoveryRacks: number
  valueRecoveryItad: number
  qtdBoxes: number | null
  qtdPallets: number | null
  qtdGaylords: number | null
  qtdRacks: number | null
  placasPolicarbonato: number | null
  requerPalletsVazios: number
  qtdPalletsVazios: number | null
  itensMais25kg: number
  fatorLimitante: string | null
  escopo: string | null
  observacoes: string | null
  /** Pré-cálculo do momento da criação (JSON). */
  calculo: string | null
  /** Chegada na Re-Teck (início do SLA). */
  recebidoEm: string | null
  /** Entrou na etapa (status) atual. */
  etapaDesde: string | null
  codEmitidoEm: string | null
  /** Processamento num sistema de fora (MoonShot): fase atual "i/N · nome". */
  processamentoSistema: string | null
  processamentoEtapa: string | null
  processamentoIndice: number | null
  processamentoTotal: number | null
  processamentoDesde: string | null
  /** Tela do lote no sistema de fora. */
  processamentoUrl: string | null
  processamentoAtualizadoEm: string | null
  /** Pedido de devolução ao recebimento (o sistema de fora achou erro no recebimento). */
  devolucaoMotivo: string | null
  devolucaoPedidoPor: string | null
  devolucaoEm: string | null
  /** Lote que nasceu num sistema de fora (Gerenciamento de Projetos): o sistema e o id lá. */
  externoSistema: string | null
  externoId: string | null
  /** O que o sistema de fora disse da ordem (JSON, só para mostrar). */
  externoDados: string | null
  /** Juntado ao lote principal da mesma coleta (22/10/2026); null = lote das listas. */
  juntadoA: string | null
}

export interface OrdensListaView extends OrdensTable {
  /** IERP (agendado aqui) ou o sistema de onde o lote veio. */
  origem: string
  clienteNome: string
  clienteSlaDias: number | null
  /** Sistema que processa os lotes do cliente (null = aqui). */
  clienteSistema: string | null
  /** Dias na mesma etapa até virar anomalia (do cliente). */
  clienteDiasParado: number | null
  siteCodigo: string
  docaNumero: string
  transportadoraNome: string | null
  motoristaNome: string | null
  totalVolumes: number
}

export interface OrdensAnexosTable {
  id: string
  /** Número sequencial (o contrato de integração identifica o anexo por número). */
  numero: number | null
  ordemId: string
  secao: string
  /** escopo | nota_fiscal | mtr | cdf | foto | outro */
  tipo: string
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/** Lote excluído (27/10/2026): o registro que fica para a auditoria e segura a sequência. */
export interface OrdensExcluidasTable {
  id: string
  numero: number
  codigo: string
  clienteId: string
  excluidoEm: string
  excluidoPor: string
}

/** Etapas por onde o lote passou (linha do tempo). */
export interface OrdensEtapasTable {
  id: string
  ordemId: string
  etapa: string
  em: string
  autor: string
}

/** Pallets recebidos (integração ou Operação › Recebimento). */
export interface OrdensPalletsTable {
  id: string
  ordemId: string
  numero: number
  /** kg */
  pesoKg: number | null
  taraKg: number | null
  conteudo: string | null
  pesadoPor: string | null
  pesadoEm: string | null
  fotoExtensao: string | null
  origem: string
  criadoEm: string
}

/** Ocorrências do lote (coleta, trajeto, recebimento); texto = LocalizedText em JSON. */
export interface OrdensOcorrenciasTable {
  id: string
  ordemId: string
  numero: number
  momento: string
  categoria: string
  texto: string
  status: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface OrdensOcorrenciasFotosTable {
  id: string
  ocorrenciaId: string
  posicao: number
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/** Recebimento do lote (Operação › Recebimento) — um por lote. */
export interface OrdensRecebimentosTable {
  ordemId: string
  dataRecebimento: string
  inspecao: string
  /** LocalizedText em JSON (avaria/outro). */
  inspecaoDescricao: string | null
  ocorrenciaId: string | null
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface OrdensItensRecebimentoTable {
  id: string
  ordemId: string
  posicao: number
  numero: string
}

export interface OrdensRecebimentoFotosTable {
  id: string
  ordemId: string
  alvo: string
  alvoId: string | null
  posicao: number
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

/** Sistema › Cadastros: materiais (nome em LocalizedText JSON + nome_ordem em português). */
export interface MateriaisTable {
  id: string
  nome: string
  nomeOrdem: string
  status: string
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Áreas do estoque (descrição opcional, LocalizedText JSON). */
export interface AreasEstoqueTable {
  id: string
  nome: string
  descricao: string | null
  status: string
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Caixotes e pallets (recipientes do estoque). */
export interface RecipientesTable {
  id: string
  tipo: string
  ano: number
  numero: number
  codigo: string
  materialId: string
  taraKg: number
  areaId: string
  posicao: string
  status: string
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Perfis de acesso: nível de cada página (JSON); `fixo` = Administrador. */
export interface PerfisAcessoTable {
  id: string
  nome: string
  nomeOrdem: string
  descricao: string | null
  fixo: number
  permissoes: string
  status: string
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Sistema de fora integrado (MoonShot…): chave, avisos e painel. */
export interface IntegracoesTable {
  id: string
  sistema: string
  nome: string
  chaveHash: string | null
  chavePrefixo: string | null
  chaveCriadaEm: string | null
  urlAvisos: string | null
  urlPainel: string | null
  tokenPainel: string | null
  status: string
  ultimoUsoEm: string | null
  ultimoAvisoEm: string | null
  ultimoPainelEm: string | null
  ultimoErro: string | null
  ultimoErroEm: string | null
  /** Resumo da última sincronização (JSON) — sistemas de onde os lotes vêm. */
  sincronizacao: string | null
  /** Certificado PÚBLICO (PEM) da CA do sistema, se ele serve HTTPS com CA própria. */
  caPainel: string | null
  /** Chave do mapa de trânsito (TomTom) — só do rastreador. Nunca sai do servidor. */
  chaveTransito: string | null
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Viagem do lote (Ordens › Viagens) — uma por caminhão (22/10/2026: várias por lote). */
export interface OrdensViagensTable {
  id: string
  ordemId: string
  /** O caminhão do lote (1, 2, 3…). */
  numero: number
  /**
   * O código da viagem no rastreador (29/10/2026): o do lote na 1ª, LOT-…-V2, -V3… nas seguintes
   * (o rastreador recusa duas viagens ativas com o mesmo código). Vai no link do motorista.
   */
  codigoRastreio: string | null
  /** Quem a Re-Teck escalou para este caminhão (o que o rastreador conta: motoristaNome/placa). */
  motoristaId: string | null
  placaInformada: string | null
  /** celular (app do motorista, ReTeckTracker) | aparelho (rastreador no caminhão). */
  origem: string
  /** O aparelho de GPS (origem aparelho). */
  rastreadorId: string | null
  /** 6 dígitos, falado no destino — nunca vai no link do motorista. */
  codigoChegada: string
  /** aguardando_motorista | em_rota | chegou | finalizada | cancelada */
  status: string
  tripId: number | null
  codigoRegistrado: number
  encerrarNoRastreador: number
  /** motorista | operador | recebimento | rastreador */
  finalizadaPor: string | null
  motoristaNome: string | null
  placa: string | null
  iniciadaEm: string | null
  chegouEm: string | null
  terminadaEm: string | null
  ultimaLatitude: number | null
  ultimaLongitude: number | null
  ultimaVelocidade: number | null
  ultimaEm: string | null
  totalPontos: number
  distanciaMetros: number | null
  emergenciaTipo: string | null
  emergenciaEm: string | null
  emergenciaLatitude: number | null
  emergenciaLongitude: number | null
  emergenciaCienteEm: string | null
  emergenciaCientePor: string | null
  chat: string | null
  paradas: string | null
  arquivada: number
  criadoEm: string
  alteradoEm: string
}

/** Tipos de documento do lote (catálogo único; os do sistema têm nome null). */
export interface TiposDocumentoTable {
  codigo: string
  /** LocalizedText JSON (null = do sistema, rótulo pela tradução). */
  nome: string | null
  nomeBusca: string | null
  ordem: number
  criadoEm: string
  criadoPor: string
}

/** Por cliente: o tipo é aceito nos documentos do lote? vai no relatório final? (0/1) */
export interface ClientesTiposDocumentoTable {
  clienteId: string
  tipoCodigo: string
  aceita: number
  relatorio: number
}

/** Rastreador GPS do caminhão (o aparelho; aparece sozinho na leitura do servidor de GPS). */
export interface RastreadoresTable {
  id: string
  /** O id da placa (minúsculo). Único. */
  deviceId: string
  placa: string | null
  descricao: string | null
  /** ativo | inativo */
  status: string
  firmware: string | null
  ultimoContatoEm: string | null
  /** O bloco `status` do último envio (JSON). */
  ultimoStatus: string | null
  ultimaLatitude: number | null
  ultimaLongitude: number | null
  /** m/s */
  ultimaVelocidade: number | null
  ultimoPontoEm: string | null
  ultimoSeq: number | null
  pontosPerdidos: Generated<number>
  criadoEm: string
  alteradoEm: string
}

/** Trajeto arquivado da viagem (replay). */
export interface OrdensViagensPontosTable {
  viagemId: string
  seq: number
  latitude: number
  longitude: number
  velocidade: number | null
  precisao: number | null
  registradoEm: string
}

/** Último retrato de cada item dos sistemas de estoque (Estoque › Histórico compara com ele). */
export interface EstoqueItensTable {
  sistema: string
  itemId: string
  aba: string
  codigo: string
  descricao: string | null
  /** Campos acompanhados (JSON). */
  campos: string
  ativo: number
  vistoEm: string
}

/** O que mudou no estoque de fora (entrou, saiu, mudou). */
export interface EstoqueEventosTable {
  id: string
  sistema: string
  itemId: string
  aba: string
  codigo: string
  descricao: string | null
  /** entrada | saida | alterado */
  acao: string
  mudancas: string | null
  rotulos: string | null
  em: string
}

/** Fila de avisos aos sistemas de fora. */
export interface IntegracoesAvisosTable {
  id: string
  integracaoId: string
  ordemId: string
  codigo: string
  evento: string
  tentativas: number
  proximaEm: string
  erro: string | null
  criadoEm: string
  enviadoEm: string | null
}

/** Último balanço de massa que o sistema de fora mandou (retrato). */
export interface OrdensBalancosTable {
  ordemId: string
  sistema: string
  payload: string
  recebidoEm: string
}

export interface Database {
  usuarios: UsuariosTable
  usuariosHistorico: UsuariosHistoricoTable
  clientes: ClientesTable
  clientesContatos: ClientesContatosTable
  clientesHistorico: ClientesHistoricoTable
  clientesLista: ClientesListaView
  clientesSites: ClientesSitesTable
  clientesDocas: ClientesDocasTable
  clientesDocumentos: ClientesDocumentosTable
  historico: HistoricoTable
  transportadoras: TransportadorasTable
  transportadorasContatos: TransportadorasContatosTable
  transportadorasLista: TransportadorasListaView
  motoristas: MotoristasTable
  motoristasLista: MotoristasListaView
  veiculos: VeiculosTable
  ordens: OrdensTable
  ordensLista: OrdensListaView
  ordensAnexos: OrdensAnexosTable
  ordensBalancos: OrdensBalancosTable
  integracoes: IntegracoesTable
  integracoesAvisos: IntegracoesAvisosTable
  ordensExcluidas: OrdensExcluidasTable
  ordensEtapas: OrdensEtapasTable
  ordensPallets: OrdensPalletsTable
  ordensOcorrencias: OrdensOcorrenciasTable
  ordensOcorrenciasFotos: OrdensOcorrenciasFotosTable
  ordensRecebimentos: OrdensRecebimentosTable
  ordensLacres: OrdensItensRecebimentoTable
  ordensNotasFiscais: OrdensItensRecebimentoTable
  ordensRecebimentoFotos: OrdensRecebimentoFotosTable
  materiais: MateriaisTable
  areasEstoque: AreasEstoqueTable
  recipientes: RecipientesTable
  perfisAcesso: PerfisAcessoTable
  ordensViagens: OrdensViagensTable
  ordensViagensPontos: OrdensViagensPontosTable
  rastreadores: RastreadoresTable
  tiposDocumento: TiposDocumentoTable
  clientesTiposDocumento: ClientesTiposDocumentoTable
  estoqueItens: EstoqueItensTable
  estoqueEventos: EstoqueEventosTable
}
