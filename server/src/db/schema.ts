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
}

export interface OrdensListaView extends OrdensTable {
  clienteNome: string
  clienteSlaDias: number | null
  siteCodigo: string
  docaNumero: string
  transportadoraNome: string | null
  motoristaNome: string | null
  totalVolumes: number
}

export interface OrdensAnexosTable {
  id: string
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
}
