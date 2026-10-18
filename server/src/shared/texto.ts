/** Sem acento e em minúsculas (busca que não diferencia "José" de "jose"). */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Escapa curingas do LIKE (% e _) e a própria barra — usar com `escape '\'`. */
export function escaparLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}
