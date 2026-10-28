import { create } from 'zustand'

/**
 * Versão nova do sistema (28/10/2026; não é salvo — recarregar a página já resolve): o build
 * novo encontrado e o build para o qual a pessoa escolheu "continuar o que está fazendo".
 */
interface AtualizacaoState {
  /** Build novo publicado (null = a página está na versão atual). */
  nova: string | null
  /** A pessoa adiou a atualização deste build (o pop-up não volta para ele). */
  adiada: string | null
  encontrar: (build: string) => void
  adiar: () => void
}

export const useAtualizacaoStore = create<AtualizacaoState>()((set) => ({
  nova: null,
  adiada: null,
  encontrar: (nova) => set({ nova }),
  adiar: () => set((s) => ({ adiada: s.nova })),
}))

/** Recarrega a página na versão nova. */
export const reiniciarNaVersaoNova = () => window.location.reload()
