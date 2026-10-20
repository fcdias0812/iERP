import { formatNumber } from '@/lib/format'
import type { PontoTrajeto } from '@/services/types'

/** Velocidade do GPS (m/s) em km/h, sem casas. */
export const kmh = (v: number | null) =>
  v === null ? null : formatNumber(v * 3.6, { maximumFractionDigits: 0 })

/** Distância percorrida (m) somando os trechos do trajeto (Haversine) — a da viagem na rua. */
export function distanciaDoTrajeto(t: PontoTrajeto[]) {
  const R = 6_371_000
  const rad = (g: number) => (g * Math.PI) / 180
  let total = 0
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1]!
    const b = t[i]!
    const h =
      Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
      Math.cos(rad(a.latitude)) *
        Math.cos(rad(b.latitude)) *
        Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
    total += 2 * R * Math.asin(Math.sqrt(h))
  }
  return total
}
