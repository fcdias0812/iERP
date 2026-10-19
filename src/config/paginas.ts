import { CONTEXTS, type LabelKey, type NavItem } from './navigation'

/*
 * Páginas que recebem permissão nos Perfis de acesso — tiradas do próprio menu (um item = uma
 * página; Início é livre). A chave é a permissão do item sem o `.ver` (`clientes`,
 * `ordens.lotes`…). Item novo no menu entra sozinho aqui; no servidor, inclua em
 * `server/src/shared/paginas.ts`.
 *
 * Grupos (na tela do perfil): cada módulo com submenu é um grupo; os módulos sem submenu de uma
 * seção do menu (Clientes, Transportadoras…) ficam juntos num grupo com o nome da seção.
 */

export interface PaginaDoMenu {
  chave: string
  labelKey: LabelKey
}
export interface GrupoDePaginas {
  id: string
  labelKey: LabelKey
  paginas: PaginaDoMenu[]
}

const paginaDo = (item: NavItem): PaginaDoMenu[] =>
  item.permission ? [{ chave: item.permission.replace(/\.ver$/, ''), labelKey: item.labelKey }] : []

export const GRUPOS_DE_PAGINAS: GrupoDePaginas[] = CONTEXTS[0]!.sections.flatMap((secao) => {
  const diretos = secao.items.filter((m) => !m.children).flatMap(paginaDo)
  const comSubmenu = secao.items
    .filter((m) => m.children)
    .map((m) => ({ id: m.id, labelKey: m.labelKey, paginas: m.children!.flatMap(paginaDo) }))
  return [
    ...(diretos.length ? [{ id: secao.id, labelKey: secao.labelKey, paginas: diretos }] : []),
    ...comSubmenu,
  ].filter((g) => g.paginas.length > 0)
})

export const PAGINAS = GRUPOS_DE_PAGINAS.flatMap((g) => g.paginas.map((p) => p.chave))
