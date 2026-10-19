import {
  Building2,
  Container,
  House,
  IdCard,
  Package,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ParseKeys } from 'i18next'

/*
 * NAVEGAÇÃO — menus, módulos, ícones e contextos ficam AQUI.
 * Adicionar/remover um módulo não exige mexer no layout:
 *  1. declare o módulo em MODULES (ícone, rótulo i18n `nav.*`, rota, permissão);
 *  2. inclua o id do módulo nas seções do(s) contexto(s) em CONTEXTS;
 *  3. crie as rotas em src/routes/_app/… (até lá, a rota "em construção" atende).
 */

/** Chave de tradução (tipada a partir do pt-BR.json). */
export type LabelKey = ParseKeys

export interface NavItem {
  id: string
  labelKey: LabelKey
  icon?: LucideIcon
  /** Rota (só em itens folha). */
  to?: string
  children?: NavItem[]
  /** Permissão necessária para ver o item. Sem permissão → o item some do menu. */
  permission?: string
  /** Contador de pendências (número). Tom neutro; vermelho só se for erro. */
  badge?: number
  /** Atalho/sinônimos extras para a busca Ctrl+K. */
  keywords?: string[]
}

export interface NavSection {
  id: string
  labelKey: LabelKey
  items: NavItem[]
}

export type ContextKind = 'cliente' | 'unidade' | 'empresa'

export interface AppContext {
  id: string
  /** Nome é dado (razão social), não texto de interface: não passa pelo i18n. */
  name: string
  /** Documento exibido no seletor (CNPJ fictício). */
  document: string
  kind: ContextKind
  sections: NavSection[]
}

// ---------------------------------------------------------------- helpers

/** Item folha com permissão `<id>.ver` por padrão. */
function leaf(
  moduleId: string,
  id: string,
  labelKey: LabelKey,
  to: string,
  extra: Partial<NavItem> = {},
): NavItem {
  return { id: `${moduleId}.${id}`, labelKey, to, permission: `${moduleId}.ver`, ...extra }
}

// ---------------------------------------------------------------- módulos

export const MODULES = {
  inicio: { id: 'inicio', labelKey: 'nav.inicio', icon: House, to: '/' },
  // Item direto (sem submenu): contatos, logística, documentos… ficam em abas do cliente.
  clientes: {
    id: 'clientes',
    labelKey: 'nav.clientes',
    icon: Building2,
    to: '/clientes',
    permission: 'clientes.ver',
  },
  transportadoras: {
    id: 'transportadoras',
    labelKey: 'nav.transportadoras',
    icon: Truck,
    to: '/transportadoras',
    permission: 'transportadoras.ver',
  },
  veiculos: {
    id: 'veiculos',
    labelKey: 'nav.veiculos',
    icon: Container,
    to: '/veiculos',
    permission: 'veiculos.ver',
  },
  motoristas: {
    id: 'motoristas',
    labelKey: 'nav.motoristas',
    icon: IdCard,
    to: '/motoristas',
    permission: 'motoristas.ver',
  },
  admin: {
    id: 'admin',
    labelKey: 'nav.admin.title',
    icon: Settings,
    children: [leaf('admin', 'usuarios', 'nav.admin.usuarios', '/admin/usuarios')],
  },
} satisfies Record<string, NavItem>

type ModuleId = keyof typeof MODULES

function section(id: string, labelKey: LabelKey, modules: ModuleId[]): NavSection {
  return { id, labelKey, items: modules.map((m) => MODULES[m]) }
}

// ---------------------------------------------------------------- contextos

/**
 * Contextos (clientes, unidades ou empresas). Cada um tem o SEU conjunto de menus.
 * Com um contexto só, o seletor do canto inferior esquerdo não aparece.
 */
export const CONTEXTS: AppContext[] = [
  {
    id: 're-teck',
    name: 'Re-Teck',
    document: '',
    kind: 'empresa',
    sections: [
      section('principal', 'nav.sections.principal', ['inicio']),
      section('relacionamento', 'nav.sections.relacionamento', [
        'clientes',
        'transportadoras',
        'veiculos',
        'motoristas',
      ]),
      section('sistema', 'nav.sections.sistema', ['admin']),
    ],
  },
]

/**
 * Telas fora do menu, mas com nome (breadcrumb e busca Ctrl+K).
 */
export const EXTRA_PAGES: NavItem[] = [
  { id: 'perfil', labelKey: 'nav.perfil', icon: Users, to: '/perfil' },
  { id: 'configuracoes', labelKey: 'nav.configuracoes', icon: Settings, to: '/configuracoes' },
]

export const DEFAULT_CONTEXT_ID = CONTEXTS[0]!.id

/** Ícone padrão para quando um item não declara o seu. */
export const FALLBACK_ICON = Package

export function getContext(id: string): AppContext {
  return CONTEXTS.find((c) => c.id === id) ?? CONTEXTS[0]!
}

/** Trilha (módulo → tela) até a rota informada, para o breadcrumb. */
export function findNavTrail(ctx: AppContext, pathname: string): NavItem[] {
  const walk = (items: NavItem[], trail: NavItem[]): NavItem[] | null => {
    for (const item of items) {
      if (item.to === pathname) return [...trail, item]
      if (item.children) {
        const found = walk(item.children, [...trail, item])
        if (found) return found
      }
    }
    return null
  }
  for (const s of ctx.sections) {
    const found = walk(s.items, [])
    if (found) return found
  }
  return walk(EXTRA_PAGES, []) ?? []
}

/** Todas as rotas conhecidas, em qualquer contexto (usado pela rota "em construção"). */
export function findNavItemAnyContext(pathname: string): NavItem | undefined {
  for (const ctx of CONTEXTS) {
    const trail = findNavTrail(ctx, pathname)
    if (trail.length) return trail[trail.length - 1]
  }
  return undefined
}
