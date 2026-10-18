#!/usr/bin/env node
/**
 * npm run check:colors
 *
 * Garante a regra "nenhuma cor fora de token" em src/:
 *  1. cor literal: #hex, rgb(), hsl(), oklch()… em .ts/.tsx/.css;
 *  2. classe Tailwind com cor arbitrária: bg-[#…], text-[oklch(…)], border-[var(--…)];
 *  3. paleta padrão do Tailwind: bg-red-500, text-white, bg-black/50…;
 *  4. paleta crua do projeto (--brand-teal-600, --success-500…) fora dos tokens.
 *
 * Exceções (documentam a paleta): src/styles/tokens/** e src/features/design-system/**.
 * Sai com código 1 se encontrar algo.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'src')
const EXCLUDED = [join(SRC, 'styles', 'tokens'), join(SRC, 'features', 'design-system')]

const UTIL =
  '(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|fill|stroke|outline|from|via|to|shadow|decoration|divide|placeholder|caret|accent)'
const TW_PALETTE =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone'

const RULES = [
  {
    name: 'cor hexadecimal',
    re: /(?<![\w/&$-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g,
  },
  { name: 'função de cor', re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g },
  {
    name: 'cor arbitrária do Tailwind',
    re: new RegExp(`\\b${UTIL}-\\[(?:#|rgb|hsl|oklch|color|var\\()`, 'g'),
  },
  {
    name: 'paleta padrão do Tailwind',
    re: new RegExp(`(?<![\\w-])${UTIL}-(?:(?:${TW_PALETTE})-\\d{2,3}|white|black)(?![\\w-])`, 'g'),
  },
  {
    name: 'paleta crua (use token semântico)',
    re: /--(?:brand-(?:green|lime|yellow|teal)|neutral|success|warning|alert|danger)-\d{2,3}\b/g,
  },
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (EXCLUDED.some((ex) => p.startsWith(ex))) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.gen.ts'))
      out.push(p)
  }
  return out
}

const problems = []
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    // Comentários de linha não contam (documentação).
    const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, '')
    for (const rule of RULES) {
      for (const m of code.matchAll(rule.re)) {
        problems.push(`${relative(root, file)}:${i + 1}  ${rule.name}: ${m[0]}`)
      }
    }
  })
}

if (problems.length) {
  console.error(`✗ ${problems.length} cor(es) fora de token:\n`)
  for (const p of problems) console.error('  ' + p)
  console.error(
    '\nUse os tokens semânticos (bg-primary, text-danger-subtle-foreground, var(--chart-1)…).',
  )
  process.exit(1)
}
console.log('✓ Nenhuma cor fora de token em src/.')
