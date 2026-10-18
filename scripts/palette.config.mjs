/**
 * Fonte das escalas de cor (50–950) do template.
 *
 * - Famílias `brand-*`: âncoras extraídas da logo Re-Teck. Os valores âncora
 *   saem EXATAMENTE como na logo, no degrau indicado.
 * - Famílias de estado (success, warning, alert, danger) e neutral: base
 *   própria, separada da marca — cor de marca não é cor de estado.
 *
 * Gere o CSS com `npm run tokens` (escreve src/styles/tokens/palette.css).
 */

export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/** Curva padrão de luminosidade (OKLCH L) por degrau. */
export const DEFAULT_L = [0.975, 0.948, 0.9, 0.835, 0.755, 0.665, 0.575, 0.495, 0.42, 0.35, 0.27]

/** Fator de croma por degrau (multiplica o croma de pico da família). */
export const DEFAULT_C = [0.1, 0.22, 0.45, 0.72, 0.9, 1, 1, 0.94, 0.84, 0.72, 0.56]

export const FAMILIES = {
  // ---------- Marca (logo, login, ilustrações, linha de degradê) ----------
  'brand-green': {
    group: 'brand',
    anchors: { 900: '#00703C', 700: '#227A48', 500: '#3EB755' },
    // 900 da logo é claro para um 900; o 950 desce mais para fechar a escala.
    lightness: { 950: 0.32 },
  },
  'brand-lime': { group: 'brand', anchors: { 400: '#A4CE45', 300: '#D3DE37' } },
  'brand-yellow': { group: 'brand', anchors: { 200: '#FDEF6A' } },
  // Azul-petróleo: é a cor de AÇÃO e INFORMAÇÃO do sistema.
  'brand-teal': { group: 'brand', anchors: { 600: '#317D82' } },

  // ---------- Estados ----------
  success: { group: 'state', anchors: { 600: '#1F8A4C' } },
  warning: { group: 'state', anchors: { 400: '#F2BE22' } },
  alert: { group: 'state', anchors: { 500: '#E8730E' } },
  danger: { group: 'state', anchors: { 600: '#CF2E2E' } },

  // ---------- Neutros (cinza levemente frio, puxado para o petróleo) ----------
  neutral: {
    group: 'neutral',
    hue: 210,
    chroma: 0.012,
    curve: [0.985, 0.967, 0.925, 0.87, 0.72, 0.6, 0.52, 0.44, 0.34, 0.255, 0.2],
    chromaCurve: [0.4, 0.5, 0.7, 0.8, 0.9, 1, 1, 1, 1, 1, 0.9],
  },
}
