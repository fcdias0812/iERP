import { normalizar } from '../../shared/texto.js'

/*
 * Para qual sistema de fora vão os lotes de cada cliente (pedido do usuário, 19/10/2026:
 * "separar os sistemas por cliente, começando pela Dell"; "todos os lotes da Dell vão para o
 * MoonShot, apenas Dell e sem exceção"). O `sistema` é o código que viaja no `destino` de cada
 * pallet do contrato — o MoonShot só aceita o pallet com `destino == "MOONSHOT"`.
 *
 * Cliente novo com sistema próprio: acrescente aqui (e cadastre o sistema em
 * Administração › Integração).
 */

export interface DestinoDeCliente {
  sistema: string
  /** Nome sugerido do sistema na tela de integrações. */
  nome: string
  /** O cliente é deste destino? (pelo nome cadastrado) */
  doCliente: (nomeCliente: string) => boolean
}

export const DESTINOS: DestinoDeCliente[] = [
  {
    sistema: 'MOONSHOT',
    nome: 'MoonShot (Dell)',
    // Palavra inteira: "Dell Computadores" sim; "Modello Ltda" não.
    doCliente: (nome) => /\bdell\b/.test(normalizar(nome)),
  },
]

/**
 * Sistema de fora SUGERIDO pelo nome do cliente (null = processado aqui). Desde 22/10/2026 quem
 * decide é a aba Configurações do cliente (`clientes.sistema_processamento`); o nome só escolhe o
 * valor inicial de um cliente novo (e a migration levou os clientes "Dell" para o MoonShot).
 */
export function sistemaDoCliente(nomeCliente: string): string | null {
  return DESTINOS.find((d) => d.doCliente(nomeCliente))?.sistema ?? null
}

/**
 * Sistema de fora que processa ESTE lote: o do cliente (aba Configurações). Lote que nasceu num
 * sistema de fora (Gerenciamento de Projetos, MSDC) nunca vai para outro: ele é só para ver aqui.
 */
export function sistemaDoLote(l: { clienteSistema: string | null; externoSistema: string | null }) {
  return l.externoSistema ? null : l.clienteSistema
}

/**
 * Os sistemas que se cadastram em Administração › Integração:
 *  - processamento: os lotes daqui VÃO para ele (chave, avisos e painel — MoonShot);
 *  - origem: os lotes VÊM dele, e o iERP só mostra (painel e token — Gerenciamento de Projetos,
 *    pedido do usuário, 20/10/2026);
 *  - rastreio: o rastreador de GPS das viagens (ReTeckTracker — endereço e chave INTERNA; o
 *    mesmo que o iERP antigo usa; `modules/viagens/`);
 *  - estoque: os sistemas de estoque lidos ao vivo nas telas do Estoque (endereço e a chave de
 *    integração deles — a mesma porta `/api/integracao/estoque` do iERP antigo; `modules/estoque/`).
 */
export type TipoSistema = 'processamento' | 'origem' | 'rastreio' | 'estoque'
export const SISTEMAS_CONHECIDOS: { sistema: string; nome: string; tipo: TipoSistema }[] = [
  ...DESTINOS.map((d) => ({ sistema: d.sistema, nome: d.nome, tipo: 'processamento' as const })),
  { sistema: 'GERENCIAMENTO', nome: 'Gerenciamento de Projetos', tipo: 'origem' },
  // Re-Teck MSDC (equip-rack-2): os lotes da Microsoft nascem e são processados lá (20/10/2026).
  { sistema: 'MSDC', nome: 'Re-Teck MSDC (Microsoft)', tipo: 'origem' },
  // Rastreador de GPS das viagens (ReTeckTracker, 20/10/2026).
  { sistema: 'RASTREADOR', nome: 'Rastreador de GPS (ReTeckTracker)', tipo: 'rastreio' },
  // Estoque (20/10/2026): Materiais ← armazém; Assets e Peças ← Controle de Notebooks;
  // E-commerce ← RTB WMS.
  { sistema: 'ARMAZEM', nome: 'Armazém (Inventory-Management)', tipo: 'estoque' },
  { sistema: 'NOTEBOOKS', nome: 'Controle de Notebooks', tipo: 'estoque' },
  { sistema: 'RTB_WMS', nome: 'RTB WMS (e-commerce)', tipo: 'estoque' },
]

/** Os códigos de sistema conhecidos. */
export const SISTEMAS = SISTEMAS_CONHECIDOS.map((d) => d.sistema)

/** O tipo do sistema (desconhecido = processamento, o caso antigo). */
export const tipoDoSistema = (sistema: string): TipoSistema =>
  SISTEMAS_CONHECIDOS.find((d) => d.sistema === sistema)?.tipo ?? 'processamento'
