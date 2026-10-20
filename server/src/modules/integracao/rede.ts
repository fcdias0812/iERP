import https from 'node:https'
import tls from 'node:tls'

/*
 * Conexão com um sistema de fora em HTTPS com certificado de uma CA PRÓPRIA (o Re-Teck MSDC
 * serve HTTPS com a CA Re-Teck). A confiança vale SÓ para a conexão com aquele sistema
 * (decisão do usuário para o iERP antigo, 28/09/2026, mantida no 2.0): nada de
 * NODE_EXTRA_CA_CERTS global, que faria o servidor aceitar, para qualquer destino, todo
 * certificado que essa CA assinar. A CA é SOMADA às públicas (se o sistema trocar por um
 * certificado público, continua funcionando).
 *
 * Sem CA cadastrada (ou com endereço http), é o `fetch` de sempre. Não segue redirecionamento
 * (os sistemas de origem não redirecionam; 3xx volta como resposta, e a leitura acusa).
 */

type Fetch = typeof fetch

/** Status que não podem ter corpo numa Response. */
const SEM_CORPO = new Set([101, 204, 205, 304])

/** Um `fetch` que confia na CA dada (PEM) só nas chamadas https que ele mesmo faz. */
export function fetchComCa(ca: string | null | undefined, base: Fetch = fetch): Fetch {
  if (!ca?.trim()) return base
  const confiaveis = [...tls.rootCertificates, ca]
  return (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada))
    if (url.protocol !== 'https:') return base(entrada, init)
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    return new Promise<Response>((ok, falha) => {
      const req = https.request(
        url,
        {
          method: init?.method ?? 'GET',
          headers,
          ca: confiaveis,
          signal: init?.signal ?? undefined,
        },
        (res) => {
          const partes: Buffer[] = []
          res.on('data', (c: Buffer) => partes.push(c))
          res.on('error', falha)
          res.on('end', () => {
            // Tudo aqui dentro roda FORA da Promise: um erro sem try derrubaria o servidor.
            try {
              const status = res.statusCode ?? 0
              if (status < 200 || status > 599) throw new Error(`O sistema respondeu ${status}.`)
              const cabecalhos = new Headers()
              for (const [k, v] of Object.entries(res.headers))
                if (typeof v === 'string') cabecalhos.set(k, v)
                else if (Array.isArray(v)) for (const x of v) cabecalhos.append(k, x)
              ok(
                new Response(SEM_CORPO.has(status) ? null : Buffer.concat(partes), {
                  status,
                  headers: cabecalhos,
                }),
              )
            } catch (e) {
              falha(e)
            }
          })
        },
      )
      req.on('error', falha)
      if (init?.body) req.write(init.body as string)
      req.end()
    })
  }) as Fetch
}
