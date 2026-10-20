/*
 * Páginas do sistema que recebem permissão nos Perfis de acesso (uma por item do menu — espelho de
 * `src/config/navigation.ts` do frontend; mudou o menu, mude aqui). Início é livre para todos.
 * Nível por página: sem acesso (ausente) | 'ver' (visualizar e exportar) | 'editar' (tudo).
 */
export const PAGINAS = [
  'clientes',
  'transportadoras',
  'veiculos',
  'motoristas',
  'ordens.lotes',
  'ordens.agendamento',
  'ordens.viagens',
  'ordens.historico',
  'operacao.dashboard',
  'operacao.lotes',
  'operacao.recebimento',
  'operacao.chamados',
  'operacao.historico',
  'estoque.materiais',
  'estoque.assets',
  'estoque.servidores',
  'estoque.ecommerce',
  'estoque.pecas',
  'estoque.historico',
  'cadastros.materiais',
  'cadastros.pallets',
  'cadastros.caixotes',
  'cadastros.areas',
  'cadastros.rastreadores',
  'admin.usuarios',
  'admin.perfis',
  'admin.auditoria',
  'admin.integracao',
] as const
export type Pagina = (typeof PAGINAS)[number]

export const NIVEIS = ['ver', 'editar'] as const
export type Nivel = (typeof NIVEIS)[number]
