#!/usr/bin/env node
/**
 * Gera as escalas OKLCH (50–950) a partir de scripts/palette.config.mjs.
 *
 * Saída:
 *  - src/styles/tokens/palette.css  → variáveis CSS (--brand-teal-600 etc.)
 *  - src/styles/tokens/palette.json → mesmos valores (oklch + hex), usados pela página /design-system
 *
 * Algoritmo: cada degrau parte de uma curva padrão de luminosidade/croma; os
 * degraus âncora recebem o valor exato da logo e os vizinhos são interpolados
 * (deslocamento de L, croma de pico e matiz) entre as âncoras. Tudo é trazido
 * para dentro do gamut sRGB antes de ser escrito.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { converter, formatHex, clampChroma } from 'culori'
import { STEPS, DEFAULT_L, DEFAULT_C, FAMILIES } from './palette.config.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const toOklch = converter('oklch')

const round = (n, d) => Number(n.toFixed(d))
const lerp = (a, b, t) => a + (b - a) * t

/** Interpola valores definidos em alguns índices para todos os índices. */
function fill(known, length, edge = 'hold') {
  const idx = Object.keys(known)
    .map(Number)
    .sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < length; i++) {
    if (i in known) {
      out.push(known[i])
      continue
    }
    const prev = idx.filter((k) => k < i).pop()
    const next = idx.find((k) => k > i)
    if (prev === undefined) out.push(edge === 'zero' ? lerp(0, known[next], i / next) : known[next])
    else if (next === undefined)
      out.push(
        edge === 'zero' ? lerp(known[prev], 0, (i - prev) / (length - 1 - prev)) : known[prev],
      )
    else out.push(lerp(known[prev], known[next], (i - prev) / (next - prev)))
  }
  return out
}

function hueLerpFill(known, length) {
  // Matiz: interpola pelo menor arco.
  const unwrapped = {}
  const keys = Object.keys(known)
    .map(Number)
    .sort((a, b) => a - b)
  let last
  for (const k of keys) {
    let h = known[k]
    if (last !== undefined) {
      while (h - last > 180) h -= 360
      while (last - h > 180) h += 360
    }
    unwrapped[k] = h
    last = h
  }
  return fill(unwrapped, length).map((h) => ((h % 360) + 360) % 360)
}

function buildFamily(name, cfg) {
  const n = STEPS.length
  if (cfg.group === 'neutral') {
    return STEPS.map((step, i) => {
      const c = clampChroma(
        { mode: 'oklch', l: cfg.curve[i], c: cfg.chroma * cfg.chromaCurve[i], h: cfg.hue },
        'oklch',
      )
      return { step, color: c, anchor: false }
    })
  }

  const anchorIdx = {}
  for (const [step, hex] of Object.entries(cfg.anchors)) {
    const i = STEPS.indexOf(Number(step))
    if (i < 0) throw new Error(`${name}: degrau inválido ${step}`)
    anchorIdx[i] = toOklch(hex)
  }

  const dL = {}
  const peak = {}
  const hue = {}
  for (const [i, c] of Object.entries(anchorIdx)) {
    dL[i] = c.l - DEFAULT_L[i]
    peak[i] = c.c / DEFAULT_C[i]
    hue[i] = c.h ?? 0
  }
  const dLs = fill(dL, n, 'zero')
  const peaks = fill(peak, n)
  const hues = hueLerpFill(hue, n)

  const result = []
  for (let i = 0; i < n; i++) {
    const step = STEPS[i]
    if (i in anchorIdx) {
      result.push({ step, color: anchorIdx[i], anchor: true })
      continue
    }
    let l = cfg.lightness?.[step] ?? DEFAULT_L[i] + dLs[i]
    // Garante escala estritamente decrescente em L.
    const prev = result[i - 1]
    if (prev && l > prev.color.l - 0.012) l = prev.color.l - 0.012
    const color = clampChroma({ mode: 'oklch', l, c: peaks[i] * DEFAULT_C[i], h: hues[i] }, 'oklch')
    result.push({ step, color, anchor: false })
  }
  // Segunda passada: garante que os degraus seguintes a âncoras também descem.
  for (let i = 1; i < n; i++) {
    if (result[i].anchor) continue
    if (result[i].color.l > result[i - 1].color.l - 0.012) {
      result[i].color = clampChroma(
        { ...result[i].color, l: result[i - 1].color.l - 0.012 },
        'oklch',
      )
    }
  }
  return result
}

const fmt = (c) => `oklch(${round(c.l, 4)} ${round(c.c, 4)} ${round(c.h ?? 0, 2)})`

const json = {}
const cssLines = [
  '/* ARQUIVO GERADO por scripts/generate-palette.mjs — não edite à mão. */',
  '/* Escalas OKLCH 50–950. Use pelos tokens semânticos (theme.css), não direto nos componentes. */',
  '',
  ':root {',
]
for (const [name, cfg] of Object.entries(FAMILIES)) {
  const scale = buildFamily(name, cfg)
  json[name] = { group: cfg.group, steps: {} }
  cssLines.push(`  /* ${name} (${cfg.group}) */`)
  for (const { step, color, anchor } of scale) {
    const value = fmt(color)
    const hex = formatHex(color)
    json[name].steps[step] = { oklch: value, hex, anchor }
    cssLines.push(`  --${name}-${step}: ${value};${anchor ? ` /* âncora da logo ${hex} */` : ''}`)
  }
  cssLines.push('')
}
cssLines.pop()
cssLines.push('}', '')

const outDir = resolve(root, 'src/styles/tokens')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'palette.css'), cssLines.join('\n'))
writeFileSync(resolve(outDir, 'palette.json'), JSON.stringify(json, null, 2) + '\n')
console.log(`Paleta gerada: ${Object.keys(json).length} famílias × ${STEPS.length} degraus.`)
