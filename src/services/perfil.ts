import { squareImageDataUrl } from '@/lib/image'
import { api } from './http'

/** Formatos aceitos para a foto de perfil e tamanho máximo do arquivo original. */
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'] as const
export const FOTO_MAX_BYTES = 5 * 1024 * 1024

/**
 * Envia a foto de perfil. A imagem é recortada (quadrado) e reduzida no navegador antes do envio;
 * a API devolve o endereço da foto salva.
 */
export async function enviarFotoPerfil(file: File): Promise<{ url: string }> {
  const imagem = await squareImageDataUrl(file)
  return api<{ url: string }>('/perfil/foto', { method: 'POST', body: { imagem } })
}

export const removerFotoPerfil = () => api<void>('/perfil/foto', { method: 'DELETE' })
