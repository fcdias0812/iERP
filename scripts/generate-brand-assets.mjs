#!/usr/bin/env node
/**
 * npm run brand
 *
 * Gera, a partir das logos originais em assets/:
 *  - src/assets/brand/logo-full.png        logo completa (tema claro), recortada
 *  - src/assets/brand/logo-full-dark.png   variação p/ tema escuro: letreiro e subtítulo claros, globo intacto
 *  - src/assets/brand/logo-globe.png       só o globo (telas estreitas)
 *  - public/favicon.ico (16/32/48), public/apple-touch-icon.png (180),
 *    public/icon-192.png e public/icon-512.png (manifest) — sem sobras, fundo transparente
 *
 * As cores claras da variação escura vêm da paleta gerada (palette.json).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_FULL = resolve(root, 'assets/Logo_Re-Teck__Completo_.png')
const SRC_GLOBE = resolve(root, 'assets/Logo_Re-Teck__Globo_.png')
const OUT_BRAND = resolve(root, 'src/assets/brand')
const OUT_PUBLIC = resolve(root, 'public')
mkdirSync(OUT_BRAND, { recursive: true })
mkdirSync(OUT_PUBLIC, { recursive: true })

const palette = JSON.parse(readFileSync(resolve(root, 'src/styles/tokens/palette.json'), 'utf8'))
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const DARK_WORDMARK = hexToRgb(palette['brand-green'].steps[100].hex)
const DARK_SUBTITLE = hexToRgb(palette.neutral.steps[200].hex)

const ALPHA_MIN = 8

/** Recorta sobras transparentes. */
async function trimmed(input) {
  const { data, info } = await sharp(input).ensureAlpha().trim({ threshold: 1 }).raw().toBuffer({
    resolveWithObject: true,
  })
  return { data, width: info.width, height: info.height }
}

const toPng = (img) =>
  sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).png({
    compressionLevel: 9,
    palette: false,
  })

/** Encontra a maior faixa vazia (só transparência) ao longo de um eixo. */
function largestGap(img, axis, from = 0, to) {
  const len = axis === 'x' ? img.width : img.height
  const other = axis === 'x' ? img.height : img.width
  to ??= len
  const filled = []
  for (let i = from; i < to; i++) {
    let any = false
    for (let j = 0; j < other && !any; j++) {
      const x = axis === 'x' ? i : j
      const y = axis === 'x' ? j : i
      if (img.data[(y * img.width + x) * 4 + 3] > ALPHA_MIN) any = true
    }
    filled.push(any)
  }
  // Só conta faixas internas (com conteúdo dos dois lados), não as margens.
  let best = { start: -1, size: 0 }
  let start = -1
  let seenContent = false
  filled.forEach((f, k) => {
    if (f) {
      if (start >= 0 && seenContent && k - start > best.size) {
        best = { start: start + from, size: k - start }
      }
      start = -1
      seenContent = true
    } else if (start < 0) start = k
  })
  return best
}

// ------------------------------------------------------------ logo completa
const full = await trimmed(SRC_FULL)
const gapX = largestGap(full, 'x')
if (gapX.size < 10) throw new Error('Não achei o espaço entre o globo e o letreiro.')
const splitX = gapX.start + Math.floor(gapX.size / 2)

// Dentro do letreiro, separa "Re-Teck" do subtítulo pela maior faixa horizontal vazia.
const textPart = {
  width: full.width - splitX,
  height: full.height,
  data: Buffer.alloc((full.width - splitX) * full.height * 4),
}
for (let y = 0; y < full.height; y++) {
  full.data.copy(
    textPart.data,
    y * textPart.width * 4,
    (y * full.width + splitX) * 4,
    (y * full.width + full.width) * 4,
  )
}
const gapY = largestGap(textPart, 'y')
const splitY = gapY.start + Math.floor(gapY.size / 2)

const dark = { ...full, data: Buffer.from(full.data) }
for (let y = 0; y < full.height; y++) {
  const color = y < splitY ? DARK_WORDMARK : DARK_SUBTITLE
  for (let x = splitX; x < full.width; x++) {
    const i = (y * full.width + x) * 4
    if (dark.data[i + 3] === 0) continue
    dark.data[i] = color[0]
    dark.data[i + 1] = color[1]
    dark.data[i + 2] = color[2]
  }
}

// Navbar: 40px de altura máx. → gera em 3× (120px) para telas de alta densidade.
const NAV_H = 120
const LOGIN_H = 240
await toPng(full).resize({ height: NAV_H }).toFile(resolve(OUT_BRAND, 'logo-full.png'))
await toPng(dark).resize({ height: NAV_H }).toFile(resolve(OUT_BRAND, 'logo-full-dark.png'))
await toPng(full).resize({ height: LOGIN_H }).toFile(resolve(OUT_BRAND, 'logo-full-login.png'))
await toPng(dark).resize({ height: LOGIN_H }).toFile(resolve(OUT_BRAND, 'logo-full-login-dark.png'))

// ------------------------------------------------------------ globo
const globe = await trimmed(SRC_GLOBE)
await toPng(globe).resize({ height: NAV_H }).toFile(resolve(OUT_BRAND, 'logo-globe.png'))
await toPng(globe).resize({ width: 480 }).toFile(resolve(OUT_BRAND, 'logo-globe-lg.png'))

// Ícones quadrados: globo centralizado, sem margem extra, fundo transparente.
const side = Math.max(globe.width, globe.height)
const squareGlobe = await toPng(globe)
  .extend({
    top: Math.floor((side - globe.height) / 2),
    bottom: Math.ceil((side - globe.height) / 2),
    left: Math.floor((side - globe.width) / 2),
    right: Math.ceil((side - globe.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer()

const icon = (size) =>
  sharp(squareGlobe)
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer()

writeFileSync(resolve(OUT_PUBLIC, 'apple-touch-icon.png'), await icon(180))
writeFileSync(resolve(OUT_PUBLIC, 'icon-192.png'), await icon(192))
writeFileSync(resolve(OUT_PUBLIC, 'icon-512.png'), await icon(512))
writeFileSync(resolve(OUT_PUBLIC, 'favicon-32.png'), await icon(32))
const ico = await pngToIco([await icon(16), await icon(32), await icon(48)])
writeFileSync(resolve(OUT_PUBLIC, 'favicon.ico'), ico)

console.log(
  `Logo: ${full.width}×${full.height}, globo|letreiro em x=${splitX}, letreiro|subtítulo em y=${splitY}.`,
)
console.log(`Globo: ${globe.width}×${globe.height}. Ícones gerados em public/.`)
