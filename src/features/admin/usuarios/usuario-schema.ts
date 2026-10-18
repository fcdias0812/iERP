import { z } from '@/lib/zod-i18n'
import type { Usuario, UsuarioInput } from '@/services/types'
import { PERFIS } from './fluxo'

/* ------------------------------------------------------------ esquema */

export const usuarioSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  email: z.email().max(160),
  perfil: z.enum(PERFIS),
})

export type UsuarioForm = z.input<typeof usuarioSchema>

export const novoUsuarioForm = (): UsuarioForm => ({
  nome: '',
  email: '',
  perfil: 'leitura',
})

export const usuarioParaForm = (u: Usuario): UsuarioForm => ({
  nome: u.nome,
  email: u.email,
  perfil: u.perfil,
})

export const formParaInput = (v: z.output<typeof usuarioSchema>): UsuarioInput => ({
  nome: v.nome.trim(),
  email: v.email.trim().toLowerCase(),
  perfil: v.perfil,
})
