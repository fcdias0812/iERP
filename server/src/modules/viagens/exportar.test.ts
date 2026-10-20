import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatoValido, gerarCsv, gerarGpx, gerarKml, nomeBaseDoArquivo } from './exportar.js'

/*
 * Trava os arquivos do trajeto — quem os consome (Google Earth, apps de GPS, planilhas) depende do
 * formato exato. Os mesmos casos do iERP antigo (`exportarViagem.test.js`).
 */

const viagem = {
  codigoLote: 'LOT-00001',
  cliente: 'Metalúrgica São João Ltda',
  placa: 'ABC1D23',
  iniciadaEm: '2026-08-08T12:00:00Z',
}
const pontos = [
  {
    latitude: -23.55,
    longitude: -46.63,
    velocidade: 12.5,
    precisao: 5,
    registradoEm: '2026-08-08T12:00:10.000Z',
  },
  {
    latitude: -23.56,
    longitude: -46.64,
    velocidade: null,
    precisao: null,
    registradoEm: '2026-08-08T12:00:20Z',
  },
]

describe('viagens › arquivos do trajeto', () => {
  it('formato: só gpx, kml e csv', () => {
    for (const f of ['gpx', 'kml', 'csv']) assert.equal(formatoValido(f), true)
    assert.equal(formatoValido('pdf'), false)
    assert.equal(formatoValido('toString'), false)
  })

  it('nome do arquivo: cliente_placa_data_lote, sem acento nem símbolo (dia de São Paulo)', () => {
    assert.equal(
      nomeBaseDoArquivo(viagem),
      'Metalurgica-Sao-Joao-Ltda_ABC1D23_2026-08-08_LOT-00001',
    )
    // 01h UTC ainda é o dia anterior em São Paulo.
    assert.equal(
      nomeBaseDoArquivo({ ...viagem, iniciadaEm: '2026-08-09T01:00:00Z' }).split('_')[2],
      '2026-08-08',
    )
  })

  it('csv: cabeçalho + uma linha por ponto, nulos vazios', () => {
    const linhas = gerarCsv(viagem, pontos).split('\n')
    assert.equal(linhas[0], 'seq,latitude,longitude,speed_mps,accuracy_m,recorded_at_utc')
    assert.equal(linhas[1], '1,-23.55,-46.63,12.5,5,2026-08-08T12:00:10Z')
    assert.equal(linhas[2], '2,-23.56,-46.64,,,2026-08-08T12:00:20Z')
  })

  it('gpx: trilha válida com pontos e horas; só & < > escapam', () => {
    const gpx = gerarGpx({ ...viagem, cliente: 'A & B <teste>' }, pontos)
    assert.match(gpx, /<gpx version="1.1"/)
    assert.match(gpx, /<trkpt lat="-23.55" lon="-46.63">/)
    assert.match(gpx, /<time>2026-08-08T12:00:10Z<\/time>/)
    assert.match(gpx, /<speed>12.5<\/speed>/)
    assert.match(gpx, /A &amp; B &lt;teste&gt;/)
    assert.match(gerarGpx(viagem, pontos), /Metalúrgica São João Ltda/)
  })

  it('kml: rota em linha única + início e fim', () => {
    const kml = gerarKml(viagem, pontos)
    assert.match(kml, /<coordinates>-46.63,-23.55,0 -46.64,-23.56,0<\/coordinates>/)
    assert.match(kml, /<name>Início<\/name>/)
    assert.match(kml, /<name>Fim<\/name>/)
  })
})
