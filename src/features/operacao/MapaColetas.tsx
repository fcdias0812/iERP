import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import type { DashboardOperacao } from '@/services/types'
import { CHAVE_ESRI, TEM_SATELITE, type FundoMapa } from './mapa-config'

/*
 * Mapa dos datacenters Microsoft (Leaflet), carregado sob demanda pelo dashboard.
 *
 * Fundos:
 *  - Limpo: OpenStreetMap (crédito visível; política operations.osmfoundation.org/policies/tiles);
 *  - Cinza: os mesmos tiles do OpenStreetMap em escala de cinza (filtro CSS — sem outro provedor);
 *  - Satélite: ArcGIS World Imagery com chave da Esri (VITE_ESRI_API_KEY, conta gratuita da
 *    ArcGIS Location Platform). Exige o crédito "Powered by Esri" + fontes das imagens. Sem
 *    chave, a tela esconde o botão Satélite.
 */

const OSM = {
  url:
    (import.meta.env.VITE_MAP_TILES_URL as string | undefined) ??
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribuicao:
    (import.meta.env.VITE_MAP_TILES_ATTRIBUTION as string | undefined) ??
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

const SATELITE = {
  url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${CHAVE_ESRI ?? ''}`,
  atribuicao:
    'Powered by <a href="https://www.esri.com">Esri</a> | Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
}

/** Região de Campinas (sem ponto ainda). */
const PADRAO: L.LatLngTuple = [-22.9, -47.06]

type Ponto = DashboardOperacao['mapa']['pontos'][number]

/** Balão com o número de coletas (cores do design system). */
const balao = (n: number) =>
  L.divIcon({
    className: '',
    html: `<span class="flex size-8 items-center justify-center rounded-full border-2 border-card num type-label shadow-popover ${
      n > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
    }">${n}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

export default function MapaColetas({
  pontos,
  fundo,
  rotulo,
}: {
  pontos: Ponto[]
  fundo: FundoMapa
  /** Nome acessível do mapa. */
  rotulo: string
}) {
  const { t } = useTranslation()
  const elemento = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const camada = useRef<L.TileLayer | null>(null)
  const marcadores = useRef<L.LayerGroup | null>(null)
  const enquadrado = useRef(false)

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
    m.setView(PADRAO, 9)
    marcadores.current = L.layerGroup().addTo(m)
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      camada.current = null
      marcadores.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cria uma vez; textos fixos ao abrir
  }, [])

  // Fundo (troca a camada de tiles).
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    camada.current?.remove()
    const f = fundo === 'satelite' && TEM_SATELITE ? SATELITE : OSM
    camada.current = L.tileLayer(f.url, { attribution: f.atribuicao, maxZoom: 19 }).addTo(m)
  }, [fundo])

  // Pontos (balões com o número de coletas e o código do site).
  useEffect(() => {
    const m = mapa.current
    const grupo = marcadores.current
    if (!m || !grupo) return
    grupo.clearLayers()
    for (const p of pontos)
      L.marker([p.latitude, p.longitude], { icon: balao(p.coletas), keyboard: false })
        .bindTooltip(p.siteCodigo, { permanent: true, direction: 'bottom', offset: [0, 14] })
        .addTo(grupo)
    // Enquadra uma vez (depois, quem manda no zoom é a pessoa).
    if (pontos.length && !enquadrado.current) {
      enquadrado.current = true
      m.fitBounds(L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude])), {
        padding: [48, 48],
        maxZoom: 12,
      })
    }
  }, [pontos])

  return (
    <div
      ref={elemento}
      role="region"
      aria-label={rotulo}
      className={cn(
        'relative z-0 h-96 w-full overflow-hidden rounded-md border',
        fundo === 'cinza' && '[&_.leaflet-tile-pane]:grayscale',
      )}
    />
  )
}
