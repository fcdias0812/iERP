// Fontes servidas pelo próprio projeto (@fontsource) — nada de CDN.
import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

let cjkLoaded: Promise<unknown> | null = null

/**
 * Noto Sans TC é pesada: só é carregada quando o idioma é zh-TW.
 * Os arquivos são divididos por unicode-range, então o navegador baixa
 * apenas os blocos de caracteres usados na tela.
 */
export function loadCjkFont() {
  cjkLoaded ??= Promise.all([
    import('@fontsource/noto-sans-tc/400.css'),
    import('@fontsource/noto-sans-tc/500.css'),
    import('@fontsource/noto-sans-tc/600.css'),
  ])
  return cjkLoaded
}
