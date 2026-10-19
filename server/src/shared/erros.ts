import type { ErrorRequestHandler, RequestHandler } from 'express'
import { MulterError } from 'multer'
import { ZodError } from 'zod'

/*
 * Erros da API no formato do contrato do frontend (src/services/http.ts):
 *   { code, message, details? } + status HTTP.
 * Códigos usados pelo frontend: not_found, validation, invalid_transition, email_in_use.
 */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ErroApi'
  }
}

export const naoEncontrado = (message = 'Registro não encontrado.') =>
  new ErroApi(404, 'not_found', message)

/** Rota /api inexistente. */
export const rotaInexistente: RequestHandler = (req) => {
  throw new ErroApi(404, 'not_found', `Rota não encontrada: ${req.method} ${req.originalUrl}`)
}

// O Express reconhece o tratador de erros pelos 4 parâmetros.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const tratarErros: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ErroApi) {
    res.status(err.status).json({ code: err.code, message: err.message, details: err.details })
    return
  }
  if (err instanceof ZodError) {
    const primeiro = err.issues[0]
    const campo = primeiro?.path.join('.')
    res.status(422).json({
      code: 'validation',
      message: campo ? `${campo}: ${primeiro?.message}` : (primeiro?.message ?? 'Dados inválidos.'),
      details: err.issues,
    })
    return
  }
  // Envio de arquivo (multer): arquivo grande demais ou campo inesperado.
  if (err instanceof MulterError) {
    const grande = err.code === 'LIMIT_FILE_SIZE'
    res.status(grande ? 413 : 422).json({
      code: grande ? 'file_too_large' : 'validation',
      message: grande ? 'Arquivo maior que o permitido.' : `Envio inválido (${err.code}).`,
    })
    return
  }
  // JSON malformado no corpo (express.json).
  if (err instanceof SyntaxError && 'body' in err) {
    res
      .status(400)
      .json({ code: 'invalid_json', message: 'Corpo da requisição não é JSON válido.' })
    return
  }
  console.error(err)
  res.status(500).json({ code: 'server_error', message: 'Erro interno do servidor.' })
}
