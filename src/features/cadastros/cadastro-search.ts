import { z } from 'zod'

/* Parâmetros da URL das telas de Sistema › Cadastros (leve: as rotas importam daqui). */
export const cadastroSearchSchema = z.object({
  /** Painel de cadastro/edição: "novo" ou o id. */
  aberto: z.string().optional().catch(undefined),
})
