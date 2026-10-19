/**
 * Cidade do endereço do site ("Rua, bairro, Campinas – SP" → "Campinas"): o último trecho entre
 * vírgulas antes da UF. Sem a UF no fim, null (o endereço foi escrito de outro jeito).
 */
export function cidadeDoEndereco(endereco: string | null | undefined): string | null {
  const m = endereco?.trim().match(/^(.*\S)\s*[–-]\s*[A-Za-z]{2}$/)
  if (!m) return null
  return m[1]!.split(',').pop()!.trim() || null
}
