import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatDateTime } from '@/lib/format'
import { URL_TRANSITO } from '@/services/viagens'
import type { PoiEstrada, Viagem, ViagemDetalhe } from '@/services/types'
import type { CamadasMapa, CaixaMapa } from './mapa-viagens'

/*
 * O mapa de Ordens › Viagens (Leaflet, carregado sob demanda): os caminhões na última posição, o
 * trajeto e as paradas da viagem escolhida (e o replay das finalizadas), mais as camadas:
 *  - Trânsito: TomTom (raster flow, estilo relative0) pelo servidor, que guarda a chave;
 *  - Postos/balanças: OpenStreetMap (Overpass) pelo servidor, que guarda um dia por região;
 *  - Pontos: os locais de coleta (sites) das viagens da lista.
 * Fundo: OpenStreetMap, com o crédito visível.
 */

const OSM = {
  url:
    (import.meta.env.VITE_MAP_TILES_URL as string | undefined) ??
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribuicao:
    (import.meta.env.VITE_MAP_TILES_ATTRIBUTION as string | undefined) ??
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

/** Região de Campinas (sem nada para mostrar ainda). */
const PADRAO: L.LatLngTuple = [-22.9, -47.06]

/** Postos e balanças só com zoom de estrada (a consulta é por região). */
const ZOOM_POIS = 10

// Desenhos do lucide (ISC) em SVG puro: o Leaflet não desenha componentes React.
const svg = (corpo: string, classe = 'size-4') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${classe}" aria-hidden="true">${corpo}</svg>`
const CAMINHAO = svg(
  '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
)
const POSTO = svg(
  '<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/>',
  'size-3',
)
const BALANCA = svg(
  '<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>',
  'size-3',
)
const LOCAL = svg(
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
)

const icone = (html: string, tamanho: number) =>
  L.divIcon({
    className: '',
    html,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
  })

/** Caminhão: a cor segue a situação (emergência = vermelho; chegou = amarelo; na rua = azul). */
function iconeCaminhao(v: Viagem, escolhida: boolean) {
  const sos = v.emergencia && !v.emergencia.cienteEm
  const cor = sos
    ? 'bg-danger text-danger-foreground'
    : v.status === 'chegou'
      ? 'bg-warning text-warning-foreground'
      : v.status === 'em_rota'
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted text-muted-foreground'
  return icone(
    `<span class="flex size-8 items-center justify-center rounded-full border-2 shadow-popover ${cor} ${
      escolhida ? 'border-foreground' : 'border-card'
    }">${CAMINHAO}</span>`,
    32,
  )
}

const ICONE_LOCAL = icone(
  `<span class="flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-popover">${LOCAL}</span>`,
  24,
)
const ICONE_PARADA = icone(
  '<span class="block size-3 rounded-full border-2 border-card bg-warning shadow-popover"></span>',
  12,
)
const ICONE_POSTO = icone(
  `<span class="flex size-5 items-center justify-center rounded-full border bg-card text-foreground">${POSTO}</span>`,
  20,
)
const ICONE_BALANCA = icone(
  `<span class="flex size-5 items-center justify-center rounded-full border bg-card text-foreground">${BALANCA}</span>`,
  20,
)

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export default function MapaViagem({
  viagens,
  selecionada,
  selecionadaId,
  onSelecionar,
  camadas,
  pois,
  onCaixa,
  replay,
  rotulo,
  alto = false,
}: {
  viagens: Viagem[]
  selecionada: ViagemDetalhe | null
  selecionadaId: string | null
  onSelecionar?: (id: string) => void
  camadas: CamadasMapa
  pois: PoiEstrada[]
  /** Região à vista (com zoom de estrada) — para buscar postos e balanças. */
  onCaixa?: (caixa: CaixaMapa | null) => void
  /** Replay: o índice do ponto do trajeto onde o caminhão está. */
  replay?: number | null
  /** Nome acessível do mapa. */
  rotulo: string
  alto?: boolean
}) {
  const { t } = useTranslation()
  const elemento = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const grupos = useRef<Record<
    'transito' | 'pontos' | 'caminhoes' | 'rota' | 'pois',
    L.LayerGroup
  > | null>(null)
  const enquadrado = useRef(false)
  const rotaEnquadrada = useRef<string | null>(null)
  const avisarCaixa = useRef(onCaixa)
  const selecionar = useRef(onSelecionar)
  useEffect(() => {
    avisarCaixa.current = onCaixa
    selecionar.current = onSelecionar
  })

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
    L.tileLayer(OSM.url, { attribution: OSM.atribuicao, maxZoom: 19 }).addTo(m)
    m.setView(PADRAO, 8)
    grupos.current = {
      transito: L.layerGroup().addTo(m),
      pontos: L.layerGroup().addTo(m),
      pois: L.layerGroup().addTo(m),
      rota: L.layerGroup().addTo(m),
      caminhoes: L.layerGroup().addTo(m),
    }
    const caixa = () => {
      if (m.getZoom() < ZOOM_POIS) return avisarCaixa.current?.(null)
      const b = m.getBounds()
      avisarCaixa.current?.({
        s: b.getSouth(),
        w: b.getWest(),
        n: b.getNorth(),
        e: b.getEast(),
      })
    }
    m.on('moveend', caixa)
    mapa.current = m
    return () => {
      m.off('moveend', caixa)
      m.remove()
      mapa.current = null
      grupos.current = null
      // Mapa novo (o React de desenvolvimento monta duas vezes): enquadra de novo.
      enquadrado.current = false
      rotaEnquadrada.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cria uma vez; textos fixos ao abrir
  }, [])

  // Trânsito por cima do fundo.
  useEffect(() => {
    const g = grupos.current?.transito
    if (!g) return
    g.clearLayers()
    if (camadas.transito)
      L.tileLayer(URL_TRANSITO, {
        attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>',
        maxZoom: 19,
        opacity: 0.85,
      }).addTo(g)
  }, [camadas.transito])

  // Locais de coleta (camada Pontos).
  useEffect(() => {
    const g = grupos.current?.pontos
    if (!g) return
    g.clearLayers()
    if (!camadas.pontos) return
    const vistos = new Set<string>()
    for (const v of viagens) {
      if (v.siteLatitude === null || v.siteLongitude === null) continue
      const chave = `${v.siteLatitude}|${v.siteLongitude}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      L.marker([v.siteLatitude, v.siteLongitude], { icon: ICONE_LOCAL, keyboard: false })
        .bindTooltip(escapar(`${v.clienteNome}${v.siteCodigo ? ` · ${v.siteCodigo}` : ''}`), {
          direction: 'top',
          offset: [0, -10],
        })
        .addTo(g)
    }
  }, [viagens, camadas.pontos])

  // Postos e balanças.
  useEffect(() => {
    const g = grupos.current?.pois
    if (!g) return
    g.clearLayers()
    if (!camadas.pois) return
    for (const p of pois)
      L.marker([p.latitude, p.longitude], {
        icon: p.tipo === 'balanca' ? ICONE_BALANCA : ICONE_POSTO,
        keyboard: false,
      })
        .bindTooltip(
          escapar(
            p.nome ?? t(p.tipo === 'balanca' ? 'viagens.mapa.balanca' : 'viagens.mapa.posto'),
          ),
        )
        .addTo(g)
  }, [pois, camadas.pois, t])

  // Caminhões na última posição (ou no ponto do replay).
  useEffect(() => {
    const m = mapa.current
    const g = grupos.current?.caminhoes
    if (!m || !g) return
    g.clearLayers()
    const pontos: L.LatLngTuple[] = []
    for (const v of viagens) {
      let pos: { latitude: number; longitude: number } | null = v.posicao
      if (selecionada && v.id === selecionada.id && replay !== null && replay !== undefined)
        pos = selecionada.trajeto[replay] ?? pos
      if (!pos) continue
      pontos.push([pos.latitude, pos.longitude])
      L.marker([pos.latitude, pos.longitude], {
        icon: iconeCaminhao(v, v.id === selecionadaId),
        title: v.loteCodigo,
        alt: v.loteCodigo,
        zIndexOffset: v.id === selecionadaId ? 1000 : 0,
      })
        .bindTooltip(escapar([v.loteCodigo, v.placa].filter(Boolean).join(' · ')), {
          direction: 'top',
          offset: [0, -14],
        })
        .on('click', () => selecionar.current?.(v.id))
        .addTo(g)
    }
    for (const v of viagens)
      if (v.siteLatitude !== null && v.siteLongitude !== null)
        pontos.push([v.siteLatitude, v.siteLongitude])
    // Enquadra uma vez (depois quem manda no zoom é a pessoa); com viagem escolhida, quem
    // enquadra é o trajeto dela.
    if (pontos.length && !enquadrado.current && !selecionada?.trajeto.length) {
      enquadrado.current = true
      m.fitBounds(L.latLngBounds(pontos), { padding: [48, 48], maxZoom: 12, animate: false })
    }
  }, [viagens, selecionada, selecionadaId, replay])

  // Trajeto e paradas da viagem escolhida.
  useEffect(() => {
    const m = mapa.current
    const g = grupos.current?.rota
    if (!m || !g) return
    g.clearLayers()
    if (!selecionada) return
    const linha = selecionada.trajeto.map((p) => [p.latitude, p.longitude] as L.LatLngTuple)
    if (linha.length > 1) {
      const corte =
        replay !== null && replay !== undefined ? Math.min(replay + 1, linha.length) : linha.length
      // No replay, o que falta percorrer fica claro; o percorrido, forte.
      if (corte < linha.length)
        L.polyline(linha.slice(corte - 1), {
          className: 'stroke-muted-foreground',
          weight: 4,
          opacity: 0.5,
          interactive: false,
        }).addTo(g)
      L.polyline(linha.slice(0, corte), {
        className: 'stroke-primary',
        weight: 5,
        opacity: 0.9,
        interactive: false,
      }).addTo(g)
    }
    for (const p of selecionada.paradas)
      L.marker([p.latitude, p.longitude], { icon: ICONE_PARADA, keyboard: false })
        .bindTooltip(escapar(`${p.motivo} · ${formatDateTime(p.em)}`))
        .addTo(g)
    if (selecionada.emergencia?.latitude != null && selecionada.emergencia.longitude != null)
      L.circleMarker([selecionada.emergencia.latitude, selecionada.emergencia.longitude], {
        className: 'stroke-danger fill-danger',
        radius: 10,
        weight: 3,
        fillOpacity: 0.25,
      })
        .bindTooltip(escapar(t('viagens.emergencia.titulo')))
        .addTo(g)
    if (rotaEnquadrada.current !== selecionada.id && linha.length) {
      rotaEnquadrada.current = selecionada.id
      enquadrado.current = true
      m.fitBounds(L.latLngBounds(linha), { padding: [48, 48], maxZoom: 15, animate: false })
    }
  }, [selecionada, replay, t])

  return (
    <div
      ref={elemento}
      role="region"
      aria-label={rotulo}
      className={`relative z-0 w-full overflow-hidden rounded-md border ${alto ? 'h-96 xl:h-160' : 'h-96'}`}
    />
  )
}
