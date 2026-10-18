import { http, HttpResponse } from 'msw/http'
import { apiError, simulateNetwork } from '../config'

/** Perfil do usuário. A API real guardaria o arquivo e devolveria a URL; aqui devolve a imagem. */
export const perfilHandlers = [
  http.post('*/api/perfil/foto', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const { imagem } = (await request.json()) as { imagem?: string }
    if (!imagem?.startsWith('data:image/')) return apiError(422, 'validation', 'Imagem inválida.')
    return HttpResponse.json({ url: imagem })
  }),

  http.delete('*/api/perfil/foto', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    return new HttpResponse(null, { status: 204 })
  }),
]
