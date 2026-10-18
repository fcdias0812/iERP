#!/usr/bin/env node
/**
 * npm run check:contrast
 *
 * Lê os tokens REAIS (src/styles/tokens/palette.css + theme.css), resolve
 * var(), oklch(), #hex e color-mix(in oklab, …) e mede o contraste WCAG 2.2 de
 * todos os pares texto/fundo e componente/fundo, nos temas claro e escuro.
 *
 *  - texto normal ............ 4,5:1
 *  - componentes / texto grande 3:1
 *
 * Pares verificados:
 *  1. Convenção automática: todo `--X-foreground` contra `--X`.
 *  2. A lista explícita PAIRS abaixo.
 * Sai com código 1 se algum par falhar.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, converter, wcagContrast, clampChroma, formatHex } from 'culori'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const TEXT = 4.5
const UI = 3

const STATES = ['info', 'success', 'warning', 'alert', 'danger', 'inactive']
const SURFACES = ['background', 'card', 'elevated', 'muted']

/** [primeiro plano, fundo, mínimo, descrição] */
const PAIRS = [
  ...SURFACES.map((s) => ['foreground', s, TEXT, 'texto principal']),
  ...SURFACES.map((s) => ['muted-foreground', s, TEXT, 'texto secundário']),
  ['placeholder', 'card', TEXT, 'placeholder do campo'],
  ['background', 'foreground', TEXT, 'tooltip (cores invertidas)'],
  ['primary-foreground', 'primary-hover', TEXT, 'botão primário (hover)'],
  ['link', 'background', TEXT, 'link'],
  ['link', 'card', TEXT, 'link'],
  ['selected-foreground', 'selected', TEXT, 'item ativo / linha selecionada'],
  ['secondary-foreground', 'secondary-hover', TEXT, 'botão secundário (hover)'],
  ['destructive-foreground', 'destructive-hover', TEXT, 'botão perigo (hover)'],
  ['success-foreground', 'success-hover', TEXT, 'botão confirmar (hover)'],
  ...STATES.flatMap((s) => [
    [`${s}-subtle-foreground`, `${s}-subtle`, TEXT, `aviso/selo ${s}`],
    [`${s}-subtle-foreground`, 'card', TEXT, `texto ${s} sobre card`],
    [`${s}-border`, `${s}-subtle`, UI, `borda do aviso ${s}`],
    [`${s}-border`, 'card', UI, `borda ${s} sobre card`],
  ]),
  ['input', 'card', UI, 'borda de campo'],
  ['input', 'background', UI, 'borda de campo'],
  ['ring', 'background', UI, 'anel de foco'],
  ['ring', 'card', UI, 'anel de foco'],
  ['primary', 'background', UI, 'botão primário (limite)'],
  ['primary', 'card', UI, 'botão primário (limite)'],
  ['primary', 'selected', UI, 'indicador do item ativo'],
  ...Array.from({ length: 8 }, (_, i) => [`chart-${i + 1}`, 'card', UI, 'série de gráfico']),
]

// ---------------------------------------------------------------- parser CSS
function parseBlocks(css) {
  const blocks = {}
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(clean))) {
    const selector = m[1].trim()
    const decls = (blocks[selector] ??= {})
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':')
      if (i < 0) continue
      const prop = d.slice(0, i).trim()
      if (prop.startsWith('--'))
        decls[prop.slice(2)] = d
          .slice(i + 1)
          .trim()
          .replace(/\s+/g, ' ')
    }
  }
  return blocks
}

const palette = parseBlocks(read('src/styles/tokens/palette.css'))
const theme = parseBlocks(read('src/styles/tokens/theme.css'))

/** Junta os blocos cujo seletor inclui `sel` (ex.: ':root, .light'). */
const pick = (blocks, sel) =>
  Object.assign(
    {},
    ...Object.entries(blocks)
      .filter(([s]) =>
        s
          .split(',')
          .map((x) => x.trim())
          .includes(sel),
      )
      .map(([, d]) => d),
  )

/** Pares do menu lateral verde-escuro (`.dark.surface-sidebar`). */
const SIDEBAR_PAIRS = [
  ['foreground', 'card', TEXT, 'texto do menu'],
  ['muted-foreground', 'card', TEXT, 'item / título de seção'],
  ['muted-foreground', 'muted', TEXT, 'texto sobre área secundária'],
  ['foreground', 'muted', TEXT, 'texto sobre área secundária'],
  ['accent-foreground', 'accent', TEXT, 'item em hover'],
  ['selected-foreground', 'selected', TEXT, 'item ativo'],
  ['inactive-subtle-foreground', 'inactive-subtle', TEXT, 'contador de pendências'],
  ['primary', 'card', UI, 'indicador / ponto de pendência'],
  ['primary', 'selected', UI, 'indicador do item ativo'],
  ['ring', 'card', UI, 'anel de foco'],
  ['ring', 'accent', UI, 'anel de foco em hover'],
]

const base = { ...pick(palette, ':root'), ...pick(theme, ':root') }
const dark = { ...base, ...pick(theme, '.dark') }
const sidebar = { ...dark, ...pick(theme, '.surface-sidebar') }

/** nome → { vars, pares, convenção automática -foreground? } */
const themes = {
  claro: { vars: base, pairs: PAIRS, auto: true },
  escuro: { vars: dark, pairs: PAIRS, auto: true },
  'menu lateral (claro)': { vars: sidebar, pairs: SIDEBAR_PAIRS, auto: false },
  'menu lateral (escuro)': {
    vars: { ...sidebar, ...pick(theme, '.dark .surface-sidebar') },
    pairs: SIDEBAR_PAIRS,
    auto: false,
  },
}

const toOklab = converter('oklab')

function splitArgs(s) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

function resolveColor(value, vars, seen = new Set()) {
  value = value.trim()
  const varMatch = /^var\(--([\w-]+)\)$/.exec(value)
  if (varMatch) {
    const name = varMatch[1]
    if (seen.has(name)) throw new Error(`referência circular em --${name}`)
    if (!(name in vars)) throw new Error(`token --${name} não existe`)
    return resolveColor(vars[name], vars, new Set([...seen, name]))
  }
  const mix = /^color-mix\(\s*in oklab\s*,(.*)\)$/.exec(value)
  if (mix) {
    const [a, b] = splitArgs(mix[1])
    const parseStop = (s) => {
      const pm = /^(.*?)\s+([\d.]+)%$/.exec(s)
      return pm ? { color: pm[1], pct: Number(pm[2]) / 100 } : { color: s, pct: undefined }
    }
    const A = parseStop(a)
    const B = parseStop(b)
    const pa = A.pct ?? (B.pct !== undefined ? 1 - B.pct : 0.5)
    const ca = toOklab(resolveColor(A.color, vars, seen))
    const cb = toOklab(resolveColor(B.color, vars, seen))
    return {
      mode: 'oklab',
      l: ca.l * pa + cb.l * (1 - pa),
      a: ca.a * pa + cb.a * (1 - pa),
      b: ca.b * pa + cb.b * (1 - pa),
    }
  }
  const c = parse(value)
  if (!c) throw new Error(`cor não reconhecida: ${value}`)
  return c
}

const resolveToken = (name, vars) => {
  if (!(name in vars)) return null
  // Mapeamento para sRGB como o navegador faz (redução de croma em OKLCH).
  return clampChroma(resolveColor(vars[name], vars), 'oklch')
}

// ---------------------------------------------------------------- verificação
let failures = 0
let total = 0
for (const [themeName, { vars, pairs, auto: useAuto }] of Object.entries(themes)) {
  const auto = useAuto
    ? Object.keys(vars)
        .filter(
          (k) => k.endsWith('-foreground') && vars[k.replace(/-foreground$/, '')] !== undefined,
        )
        .map((k) => [k, k.replace(/-foreground$/, ''), TEXT, 'convenção -foreground'])
    : []

  const seen = new Set()
  const rows = []
  for (const [fg, bg, min, label] of [...auto, ...pairs]) {
    const key = `${fg}|${bg}`
    if (seen.has(key)) continue
    seen.add(key)
    const a = resolveToken(fg, vars)
    const b = resolveToken(bg, vars)
    if (!a || !b) {
      rows.push({ ok: false, fg, bg, min, ratio: NaN, label: `token ausente (${!a ? fg : bg})` })
      continue
    }
    const ratio = wcagContrast(a, b)
    rows.push({
      ok: ratio >= min,
      fg,
      bg,
      min,
      ratio,
      label,
      hexA: formatHex(a),
      hexB: formatHex(b),
    })
  }

  const bad = rows.filter((r) => !r.ok)
  total += rows.length
  failures += bad.length
  console.log(`\nTema ${themeName}: ${rows.length - bad.length}/${rows.length} pares passam`)
  for (const r of rows) {
    if (!r.ok || process.argv.includes('--verbose')) {
      const mark = r.ok ? '  ok ' : '  FALHA'
      console.log(
        `${mark} ${r.ratio.toFixed(2).padStart(5)}:1 (mín ${r.min}) --${r.fg} [${r.hexA}] sobre --${r.bg} [${r.hexB}] — ${r.label}`,
      )
    }
  }
}

console.log(`\n${total - failures}/${total} pares aprovados (WCAG 2.2 AA).`)
if (failures) {
  console.error(
    `${failures} par(es) abaixo do mínimo. Ajuste os tokens em src/styles/tokens/theme.css.`,
  )
  process.exit(1)
}
