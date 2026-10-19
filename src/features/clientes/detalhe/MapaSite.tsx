import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/*
 * Mapa do site (Leaflet + OpenStreetMap). Carregado sob demanda (React.lazy) só quando o
 * formulário do site abre: o mapa e os tiles não pesam no resto do sistema.
 *
 * Política de uso dos tiles do OpenStreetMap (operations.osmfoundation.org/policies/tiles):
 * crédito visível no mapa (controle de atribuição do Leaflet) e nada de baixar tiles em massa.
 * Outro provedor de tiles: VITE_MAP_TILES_URL (+ VITE_MAP_TILES_ATTRIBUTION).
 */

const TILES =
  (import.meta.env.VITE_MAP_TILES_URL as string | undefined) ??
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUICAO =
  (import.meta.env.VITE_MAP_TILES_ATTRIBUTION as string | undefined) ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/** Centro do Brasil (sem posição ainda). */
const BRASIL: L.LatLngTuple = [-14.235, -51.925]

/** Pino com as cores do design system (sem as imagens padrão do Leaflet). */
const pino = L.divIcon({
  className: '',
  html: '<svg viewBox="0 0 24 32" width="28" height="36" aria-hidden="true"><path class="fill-primary" d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0Z"/><circle class="fill-primary-foreground" cx="12" cy="12" r="4.5"/></svg>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
})

export interface Posicao {
  lat: number
  lng: number
}

export default function MapaSite({
  posicao,
  onChange,
  rotulo,
}: {
  posicao: Posicao | null
  onChange: (p: Posicao) => void
  /** Nome acessível do mapa. */
  rotulo: string
}) {
  const { t } = useTranslation()
  const elemento = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const marcador = useRef<L.Marker | null>(null)
  const aoMudar = useRef(onChange)
  useEffect(() => {
    aoMudar.current = onChange
  }, [onChange])

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!elemento.current) return
    const m = L.map(elemento.current, { zoomControl: false, attributionControl: true })
    m.attributionControl.setPrefix(false)
    L.control
      .zoom({
        zoomInTitle: t('clientes.sites.mapa.zoomIn'),
        zoomOutTitle: t('clientes.sites.mapa.zoomOut'),
      })
      .addTo(m)
    L.tileLayer(TILES, { attribution: ATRIBUICAO, maxZoom: 19 }).addTo(m)
    m.setView(BRASIL, 4)
    m.on('click', (e: L.LeafletMouseEvent) =>
      aoMudar.current({ lat: e.latlng.lat, lng: e.latlng.lng }),
    )
    mapa.current = m
    // O formulário abre num painel animado: recalcula o tamanho depois da animação.
    const timer = window.setTimeout(() => m.invalidateSize(), 250)
    return () => {
      window.clearTimeout(timer)
      m.remove()
      mapa.current = null
      marcador.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cria uma vez; textos fixos ao abrir
  }, [])

  // Posição → pino (e centraliza).
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    if (!posicao) {
      marcador.current?.remove()
      marcador.current = null
      return
    }
    const ll: L.LatLngTuple = [posicao.lat, posicao.lng]
    if (!marcador.current) {
      marcador.current = L.marker(ll, { icon: pino, draggable: true, keyboard: false }).addTo(m)
      marcador.current.on('dragend', () => {
        const p = marcador.current!.getLatLng()
        aoMudar.current({ lat: p.lat, lng: p.lng })
      })
      m.setView(ll, Math.max(m.getZoom(), 16))
    } else {
      marcador.current.setLatLng(ll)
      if (!m.getBounds().contains(ll)) m.panTo(ll)
    }
  }, [posicao])

  return (
    <div
      ref={elemento}
      role="region"
      aria-label={rotulo}
      className="relative z-0 h-72 w-full overflow-hidden rounded-md border"
    />
  )
}
