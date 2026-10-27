import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import type { BalancoDeMassa } from '../integracao/balanco.js'
import type { Ordem } from './ordens.js'

/*
 * PDF da OS e a planilha do RELATÓRIO FINAL (pedido do usuário, 22/10/2026: "Nos lotes, devemos
 * ser capazes de gerar o pdf da ordem e o zip do relatório final"). Como no iERP 1.0
 * (`lib/pdfOrdem.js` e `lib/planilhaRelatorioFinal.js` de lá): o PDF em português, A4, com o QR
 * do link de cada caminhão rastreado (o código de chegada nunca vai no QR); a planilha com as
 * abas Recebimento e Processamento (balanço de massa). O ZIP (PDF + planilha + os documentos dos
 * tipos marcados "vai no relatório final") é montado em `ordens.ts`.
 */

export interface DadosDaOs {
  ordem: Ordem
  cliente: {
    nome: string
    cnpj: string
    contato: { nome: string | null; email: string; telefone: string } | null
  }
  site: {
    codigo: string
    endereco: string | null
    regiao: string | null
    horario: string | null
    responsavel: string | null
  } | null
  doca: {
    numero: string
    alturaMaxCaminhao: number
    comprimentoMaxCaminhao: number | null
    dockLeveler: boolean
    tailLift: boolean
    pisoProtecaoObrigatorio: boolean
  } | null
  transportadora: { nome: string; cnpj: string } | null
  caminhoes: {
    numero: number
    motorista: string | null
    placa: string | null
    link: string | null
  }[]
  /** Rótulo de cada tipo de documento (código → nome). */
  tipos: Record<string, string>
  geradoEm: string
}

const NOME_SERVICO: Record<string, string> = {
  psm: 'I. PSM (gaylords triturados)',
  onsiteShredding: 'II. Onsite Shredding (DBD)',
  recycleOnly: 'III. Recycle Only',
  valueRecoveryRacks: 'IV. Value Recovery (Racks)',
  valueRecoveryItad: 'V. Value Recovery (ITAD)',
}
const STATUS: Record<string, string> = {
  agendado: 'Agendado',
  inspecao: 'Inspeção',
  processo: 'Processo',
  aguardando_cod: 'Aguardando COD',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}
const REGIAO: Record<string, string> = {
  norte: 'Norte',
  nordeste: 'Nordeste',
  centro_oeste: 'Centro-Oeste',
  sudeste: 'Sudeste',
  sul: 'Sul',
}

const FUSO = 'America/Sao_Paulo'
const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO }) : null
const diaHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' })
const num = (v: number | null, casas = 0) =>
  v === null
    ? null
    : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const simNao = (v: boolean) => (v ? 'Sim' : 'Não')
const cnpj = (v: string) =>
  v.length === 14 ? v.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5') : v
const fone = (v: string) =>
  v.length === 11
    ? v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
    : v.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const LOGO = path.join(RAIZ, 'assets', 'logo-reteck.png')

const COR = { texto: '#1f2933', suave: '#5b6770', linha: '#d5dbe0', faixa: '#f2f5f7' }

/** O PDF da OS (Buffer). */
export async function gerarPdfDaOs(d: DadosDaOs): Promise<Buffer> {
  const o = d.ordem
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
    info: { Title: `OS ${o.codigo}`, Author: 'Re-Teck Brasil' },
  })
  const partes: Buffer[] = []
  doc.on('data', (b: Buffer) => partes.push(b))
  const fim = new Promise<Buffer>((ok) => doc.on('end', () => ok(Buffer.concat(partes))))

  const largura = doc.page.width - 80
  const esquerda = 40

  // Cabeçalho: logo, título e o QR do primeiro caminhão rastreado.
  if (existsSync(LOGO)) doc.image(LOGO, esquerda, 36, { height: 34 })
  doc
    .fillColor(COR.texto)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(`Ordem de Serviço — ${o.codigo}`, esquerda, 80)
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COR.suave)
    .text(
      [STATUS[o.status] ?? o.status, `Gerada em ${diaHora(d.geradoEm)}`].join(' · '),
      esquerda,
      doc.y + 2,
    )
  doc.moveDown(0.8)

  const secao = (titulo: string) => {
    if (doc.y > doc.page.height - 120) doc.addPage()
    doc.moveDown(0.4)
    const y = doc.y
    doc.rect(esquerda, y, largura, 18).fill(COR.faixa)
    doc
      .fillColor(COR.texto)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(titulo, esquerda + 6, y + 5)
    doc.y = y + 24
  }
  /** Uma seção com rótulo → valor; sem nenhum valor, a seção nem aparece. */
  const bloco = (titulo: string, itens: [string, string | null | undefined][]) => {
    const validos = itens.filter(([, v]) => v !== null && v !== undefined && v !== '')
    if (!validos.length) return
    secao(titulo)
    for (const [rotulo, valor] of validos) {
      if (doc.y > doc.page.height - 70) doc.addPage()
      const y = doc.y
      doc.font('Helvetica').fontSize(8.5).fillColor(COR.suave).text(rotulo, esquerda, y, {
        width: 150,
      })
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COR.texto)
        .text(String(valor), esquerda + 160, y, { width: largura - 160 })
      doc.y = Math.max(doc.y, y + 12) + 3
    }
  }
  const paragrafo = (t: string | null) => {
    if (!t) return
    doc.font('Helvetica').fontSize(9).fillColor(COR.texto).text(t, esquerda, doc.y, {
      width: largura,
    })
    doc.moveDown(0.4)
  }

  bloco('Cliente', [
    ['Cliente', d.cliente.nome],
    ['CNPJ', cnpj(d.cliente.cnpj)],
    ['Contato', d.cliente.contato?.nome],
    ['E-mail', d.cliente.contato?.email],
    ['Telefone', d.cliente.contato ? fone(d.cliente.contato.telefone) : null],
    ['Referência do cliente', o.referenciaCliente],
  ])

  bloco('Local da coleta', [
    ['Site', d.site?.codigo],
    ['Endereço', d.site?.endereco],
    ['Região', d.site?.regiao ? (REGIAO[d.site.regiao] ?? d.site.regiao) : null],
    ['Horário', d.site?.horario],
    ['Responsável no site', d.site?.responsavel],
    ['Doca', d.doca?.numero],
    ['Altura máx. do caminhão', d.doca ? `${num(d.doca.alturaMaxCaminhao, 2)} m` : null],
    [
      'Comprimento máx. do caminhão',
      d.doca?.comprimentoMaxCaminhao ? `${num(d.doca.comprimentoMaxCaminhao, 2)} m` : null,
    ],
    ['Dock leveler', d.doca ? simNao(d.doca.dockLeveler) : null],
    ['Tail lift', d.doca ? simNao(d.doca.tailLift) : null],
    ['Proteção de piso', d.doca ? simNao(d.doca.pisoProtecaoObrigatorio) : null],
  ])

  const servicos = o.coleta?.servicos ?? o.servicos
  const q = o.coleta?.quantidades ?? o.quantidades
  bloco('Serviços e quantidades', [
    [
      'Serviços',
      Object.entries(servicos)
        .filter(([, v]) => v)
        .map(([k]) => NOME_SERVICO[k] ?? k)
        .join('\n'),
    ],
    ['Pallets', num(q.pallets)],
    ['Gaylords', num(q.gaylords)],
    ['Racks', num(q.racks)],
    ['Boxes', num(q.boxes)],
    ['Placas de policarbonato', num(q.placasPolicarbonato)],
    ['Pallets vazios', q.requerPalletsVazios ? num(q.palletsVazios) : null],
    ['Itens com mais de 25 kg', simNao(q.itensMais25kg)],
    ['Fator limitante', q.fatorLimitante],
    ['Coleta prevista', dia(o.coletaPrevista)],
    ['Data de coleta', dia(o.dataColeta)],
    ['Data de chegada', dia(o.dataChegada)],
  ])

  if (o.calculo) {
    const c = o.calculo
    bloco('Recursos a mobilizar (pré-cálculo)', [
      ['Volumes', num(c.totalVolumes)],
      ['Caminhão', `${c.veiculo.tipo} (${num(c.veiculo.comprimento, 2)} m)`],
      ['Viagens', num(c.viagens)],
      ['Pessoas', num(c.totalPessoas)],
      ['Caminhão com plataforma', simNao(c.caminhaoPlataforma)],
      ['Levar shredder', simNao(c.levarShredder)],
      ['Levar gaylord', simNao(c.levarGaylordReteck)],
    ])
  }

  bloco('Transporte', [
    ['Transportadora', d.transportadora?.nome],
    ['CNPJ da transportadora', d.transportadora ? cnpj(d.transportadora.cnpj) : null],
    ['Coleta rastreada', simNao(o.rastrear)],
  ])
  // Um bloco por caminhão: motorista, placa e o QR do link do motorista.
  for (const c of d.caminhoes) {
    if (doc.y > doc.page.height - 140) doc.addPage()
    const y = doc.y
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COR.texto)
      .text(`Caminhão ${c.numero}`, esquerda, y)
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(
        [c.motorista ?? 'Motorista a definir', c.placa].filter(Boolean).join(' · '),
        esquerda,
        doc.y + 2,
      )
    if (c.link) {
      doc
        .fontSize(7.5)
        .fillColor(COR.suave)
        .text(c.link, esquerda, doc.y + 2, { width: largura - 100 })
      const qr = await QRCode.toBuffer(c.link, { width: 220, margin: 1 })
      doc.image(qr, esquerda + largura - 72, y, { width: 72 })
      doc
        .fontSize(6.5)
        .fillColor(COR.suave)
        .text('APONTE A CÂMERA PELO APP', esquerda + largura - 90, y + 74, {
          width: 108,
          align: 'center',
        })
      doc.y = Math.max(doc.y, y + 86)
    }
    doc.moveDown(0.6)
  }

  secao('Escopo de trabalho')
  paragrafo(o.escopo)
  for (const j of o.juntados) if (j.escopo) paragrafo(`${j.codigo}: ${j.escopo}`)
  if (o.observacoes || o.juntados.some((j) => j.observacoes)) {
    secao('Observações')
    paragrafo(o.observacoes)
    for (const j of o.juntados) if (j.observacoes) paragrafo(`${j.codigo}: ${j.observacoes}`)
  }
  if (o.juntados.length) {
    bloco(
      'Lotes da mesma coleta',
      o.juntados.map((j) => [j.codigo, j.referenciaCliente ?? '—']),
    )
  }
  if (o.anexos.length) {
    bloco(
      'Documentos',

      o.anexos.map((a) => [
        d.tipos[a.tipo] ?? a.tipo,
        `${a.nome}${a.loteCodigo ? ` (${a.loteCodigo})` : ''}`,
      ]),
    )
  }

  // Assinaturas.
  if (doc.y > doc.page.height - 90) doc.addPage()
  const yAss = doc.y + 30
  const meia = (largura - 30) / 2
  for (const [i, rotulo] of [
    'Responsável pela coleta (Re-Teck)',
    'Responsável no cliente',
  ].entries()) {
    const x = esquerda + i * (meia + 30)
    doc
      .moveTo(x, yAss)
      .lineTo(x + meia, yAss)
      .strokeColor(COR.linha)
      .stroke()
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COR.suave)
      .text(`${rotulo} — nome, assinatura e data`, x, yAss + 4, { width: meia })
  }

  // Rodapé em todas as páginas.
  const paginas = doc.bufferedPageRange()
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(i)
    // O rodapé fica abaixo da margem: sem zerar a margem, o pdfkit abriria uma página nova.
    doc.page.margins.bottom = 0
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COR.suave)
      .text(
        `Re-Teck — Reverse Supply Chain Management · ${o.codigo} · página ${i + 1} de ${paginas.count}`,
        esquerda,
        doc.page.height - 30,
        { width: largura, align: 'center', lineBreak: false },
      )
  }
  doc.end()
  return fim
}

/** A planilha do relatório final (Recebimento + Processamento), como no 1.0. */
export async function gerarPlanilhaDoRelatorio(
  o: Ordem,
  cliente: string,
  balanco: BalancoDeMassa | null,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Re-Teck iERP'
  const negrito = { bold: true }

  const rec = wb.addWorksheet('Recebimento')
  rec.columns = [{ width: 18 }, { width: 18 }, { width: 14 }, { width: 18 }, { width: 36 }]
  rec.addRow(['Relatório de Recebimento']).font = { bold: true, size: 14 }
  rec.addRow([])
  const ficha: [string, string | number | null][] = [
    ['Lote', o.codigo],
    ['Cliente', cliente],
    ['Referência do cliente', o.referenciaCliente],
    ['Data de recebimento', dia(o.recebidoEm)],
    [
      'Placa(s)',
      [...new Set(o.caminhoes.map((c) => c.placa).filter(Boolean))].join(', ') || o.placa,
    ],
    ['Lacres', o.recebimento?.lacres.map((l) => l.numero).join(', ') || null],
    ['Notas fiscais', o.recebimento?.notas.map((n) => n.numero).join(', ') || null],
    [
      'Inspeção visual',
      o.recebimento
        ? (({ bom: 'Bom', avaria: 'Avaria', outro: 'Outro' } as Record<string, string>)[
            o.recebimento.inspecao
          ] ?? o.recebimento.inspecao)
        : null,
    ],
  ]
  for (const [k, v] of ficha) {
    const r = rec.addRow([k, v ?? '—'])
    r.getCell(1).font = negrito
  }
  rec.addRow([])
  const cab = rec.addRow([
    'Pallet',
    'Peso bruto (kg)',
    'Tara (kg)',
    'Peso líquido (kg)',
    'Conteúdo',
  ])
  cab.font = negrito
  const pallets = o.pallets.filter((p) => p.pesoKg !== null)
  for (const p of pallets)
    rec.addRow([p.numero, p.pesoKg, p.taraKg, p.pesoLiquidoKg, p.conteudo ?? ''])
  const soma = (f: (p: (typeof pallets)[number]) => number | null) =>
    pallets.reduce((a, p) => a + (f(p) ?? 0), 0)
  const total = rec.addRow([
    'Total',
    soma((p) => p.pesoKg),
    soma((p) => p.taraKg),
    soma((p) => p.pesoLiquidoKg),
    `${pallets.length} pallet(s)`,
  ])
  total.font = negrito
  for (const c of [2, 3, 4]) rec.getColumn(c).numFmt = '#,##0.00'

  const proc = wb.addWorksheet('Processamento')
  proc.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 22 }]
  proc.addRow(['Relatório de Processamento (balanço de massa)']).font = { bold: true, size: 14 }
  proc.addRow([])
  if (!balanco) {
    proc.addRow(['O balanço de massa deste lote ainda não chegou.'])
  } else {
    const resumo: [string, number | string | null][] = [
      ['Sistema', balanco.sistema],
      ['Peso bruto recebido (kg)', balanco.brutoKg],
      ['Peso líquido (kg)', balanco.liquidoKg],
      ['Contabilizado (kg)', balanco.contabilizadoKg],
      ['Diferença (kg)', balanco.diferencaKg],
      ['Diferença (%)', balanco.diferencaPercent],
    ]
    for (const [k, v] of resumo) {
      const r = proc.addRow([k, v ?? '—'])
      r.getCell(1).font = negrito
    }
    proc.addRow([])
    proc.addRow(['Material', 'Peso (kg)']).font = negrito
    for (const c of balanco.commodities) proc.addRow([c.rotulo, c.pesoKg])
    if (balanco.containers.length) {
      proc.addRow([])
      proc.addRow(['Container', 'Categoria', 'Deste lote (kg)', 'Destino']).font = negrito
      for (const c of balanco.containers)
        proc.addRow([
          c.codigo,
          c.categoriaRotulo ?? c.categoria ?? '',
          c.desteLoteKg,
          c.destino ?? '',
        ])
    }
    proc.getColumn(2).numFmt = '#,##0.00'
    proc.getColumn(3).numFmt = '#,##0.00'
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
