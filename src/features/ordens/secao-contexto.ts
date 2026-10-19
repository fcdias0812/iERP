import { createContext } from 'react'

/*
 * Moldura das seções do formulário de agendamento: "pagina" (FormSection, Ordens › Agendamento)
 * ou "painel" (CadastroSecao, edição do lote no painel lateral).
 */
export const SecaoContexto = createContext<'pagina' | 'painel'>('pagina')
