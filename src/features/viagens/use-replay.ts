import { useEffect, useState } from 'react'

/* O REPLAY de uma viagem terminada: anda pelo trajeto (o mapa desenha o caminhão no índice). */

export const VELOCIDADES = [1, 4, 16] as const

export function useReplay(total: number) {
  const [indice, setIndice] = useState<number | null>(null)
  const [tocando, setTocando] = useState(false)
  const [velocidade, setVelocidade] = useState<(typeof VELOCIDADES)[number]>(4)
  useEffect(() => {
    if (!tocando || total < 2) return
    const relogio = setInterval(() => {
      setIndice((i) => {
        const proximo = Math.min((i ?? 0) + velocidade, total - 1)
        if (proximo >= total - 1) setTocando(false)
        return proximo
      })
    }, 200)
    return () => clearInterval(relogio)
  }, [tocando, velocidade, total])
  return {
    indice,
    tocando,
    velocidade,
    setIndice,
    setVelocidade,
    tocar: () => {
      if (indice === null || indice >= total - 1) setIndice(0)
      setTocando(true)
    },
    pausar: () => setTocando(false),
    reiniciar: () => {
      setTocando(false)
      setIndice(null)
    },
  }
}

export type Replay = ReturnType<typeof useReplay>
