/*
 * TRADUÇÃO AUTOMÁTICA — configuração.
 *
 * Serviço: MyMemory (https://mymemory.translated.net), gratuito e sem cadastro.
 *  - sem e-mail: 5.000 caracteres/dia; com e-mail no parâmetro `de`: 50.000 caracteres/dia
 *    (https://mymemory.translated.net/doc/usagelimits.php). A cota é por IP: na empresa,
 *    todos saem pelo mesmo IP e dividem a cota. Cada texto traduzido gasta 2× (dois idiomas).
 *  - até 500 bytes por chamada (textos maiores são quebrados em frases).
 *  - o texto SAI da empresa para um serviço público: só use em campos não sigilosos.
 *
 * Variáveis de ambiente (opcionais):
 *  - VITE_TRANSLATION=false            desliga a tradução (salva só o original)
 *  - VITE_TRANSLATION_EMAIL=...        e-mail de contato da cota maior
 *  - VITE_TRANSLATION_URL=...          outro endereço compatível (ex.: proxy no backend)
 */

const env = import.meta.env

export const TRADUCAO = {
  ativa: env.VITE_TRANSLATION !== 'false',
  url:
    (env.VITE_TRANSLATION_URL as string | undefined) ?? 'https://api.mymemory.translated.net/get',
  /** E-mail de contato do TI (sobe a cota para 50.000 caracteres/dia). Não é segredo. */
  email: (env.VITE_TRANSLATION_EMAIL as string | undefined) ?? 'rtbrti03@re-teckbr.com',
  /** Limite por chamada do MyMemory é 500 bytes; deixamos folga. */
  maxBytes: 450,
  timeoutMs: 12_000,
} as const
