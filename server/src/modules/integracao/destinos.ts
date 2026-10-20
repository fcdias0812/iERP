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

/** Sistema de fora que processa os lotes deste cliente (null = processado aqui). */
export function sistemaDoCliente(nomeCliente: string): string | null {
  return DESTINOS.find((d) => d.doCliente(nomeCliente))?.sistema ?? null
}

/** Os códigos de sistema conhecidos. */
export const SISTEMAS = DESTINOS.map((d) => d.sistema)
