import { diaNoFuso } from '../../shared/datas.js'

/*
 * Os ARQUIVOS do trajeto de uma viagem terminada (pedido do usuário, 20/10/2026: "igual o iERP
 * versão 1 tem"): GPX (apps de GPS), KML (Google Earth) e CSV (planilha). Portado de
 * `backend/src/lib/exportarViagem.js` do iERP antigo, com o MESMO formato — quem já abre os
 * arquivos de lá abre os daqui. Única diferença: o dia do nome do arquivo sai pelo fuso de São
 * Paulo (`diaNoFuso`) em vez do UTC-3 fixo.
 */

export interface ViagemParaExportar {
  codigoLote: string
  cliente: string | null
  placa: string | null
  iniciadaEm: string | null
}

export interface PontoParaExportar {
  latitude: number
  longitude: number
  /** m/s */
  velocidade: number | null
  /** metros */
  precisao: number | null
  registradoEm: string | null
}

const numero = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

/** ISO UTC sem os milissegundos (como o rastreador antigo). */
function dataIso(data: string | null | undefined) {
  if (!data) return ''
  return new Date(data).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

const escaparXml = (texto: string) =>
  texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Nome do arquivo: cliente_placa_data_lote, sem acento nem símbolo. */
export function nomeBaseDoArquivo(v: ViagemParaExportar) {
  const slug = (texto: string | null) =>
    String(texto ?? '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const dia = diaNoFuso(v.iniciadaEm ? new Date(v.iniciadaEm) : new Date())
  return `${slug(v.cliente)}_${slug(v.placa)}_${dia}_${slug(v.codigoLote)}`
}

const tituloDaViagem = (v: ViagemParaExportar) => `${v.codigoLote} - ${v.cliente ?? 'Re-Teck'}`

/** CSV: cabeçalho fixo + uma linha por ponto (campos nulos ficam vazios). */
export function gerarCsv(_v: ViagemParaExportar, pontos: PontoParaExportar[]) {
  const linhas = ['seq,latitude,longitude,speed_mps,accuracy_m,recorded_at_utc']
  pontos.forEach((p, i) =>
    linhas.push(
      [
        i + 1,
        p.latitude,
        p.longitude,
        numero(p.velocidade),
        numero(p.precisao),
        dataIso(p.registradoEm),
      ].join(','),
    ),
  )
  return linhas.join('\n')
}

/** GPX 1.1: uma trilha com um segmento. */
export function gerarGpx(v: ViagemParaExportar, pontos: PontoParaExportar[]) {
  const titulo = escaparXml(tituloDaViagem(v))
  const trkpts = pontos
    .map((p) => {
      const velocidade = p.velocidade != null ? `\n        <speed>${p.velocidade}</speed>` : ''
      const hora = p.registradoEm ? `\n        <time>${dataIso(p.registradoEm)}</time>` : ''
      return `      <trkpt lat="${p.latitude}" lon="${p.longitude}">${hora}${velocidade}\n      </trkpt>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>
<gpx version="1.1" creator="Re-Teck iERP" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${titulo}</name>
    <time>${dataIso(v.iniciadaEm)}</time>
  </metadata>
  <trk>
    <name>${titulo}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`
}

/** KML 2.2: a rota como LineString + marcadores de início e fim. */
export function gerarKml(v: ViagemParaExportar, pontos: PontoParaExportar[]) {
  const titulo = escaparXml(tituloDaViagem(v))
  const coordenadas = pontos.map((p) => `${p.longitude},${p.latitude},0`).join(' ')
  const inicio = pontos[0]!
  const fim = pontos[pontos.length - 1]!
  return `<?xml version="1.0" encoding="utf-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${titulo}</name>
    <Style id="rota">
      <LineStyle>
        <color>ff2f7dff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Rota</name>
      <styleUrl>#rota</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordenadas}</coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>Início</name>
      <Point>
        <coordinates>${inicio.longitude},${inicio.latitude},0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Fim</name>
      <Point>
        <coordinates>${fim.longitude},${fim.latitude},0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`
}

export const FORMATOS = {
  csv: { gerar: gerarCsv, contentType: 'text/csv; charset=utf-8' },
  gpx: { gerar: gerarGpx, contentType: 'application/gpx+xml' },
  kml: { gerar: gerarKml, contentType: 'application/vnd.google-earth.kml+xml' },
} as const

export type FormatoTrajeto = keyof typeof FORMATOS

export const formatoValido = (f: string): f is FormatoTrajeto => Object.hasOwn(FORMATOS, f)
