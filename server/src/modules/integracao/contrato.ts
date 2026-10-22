import type { Db } from '../../db/database.js'
import { diaNoFuso } from '../../shared/datas.js'
import { sistemaDoLote } from './destinos.js'

/*
 * A ORDEM no formato do contrato de integração — o MESMO do iERP antigo
 * (`/api/integracao/v1`), para o MoonShot funcionar com os dois sem mudar o que já existe.
 * Os campos e as regras que o MoonShot lê estão em
 * `BD-Moonshot-Operation-Scan/src/dotnet/MoonShot/MoonShot.Infrastructure/Ierp/IerpLoteService.cs`
 * e `MoonShot.Core/Ierp/EscopoDoLote.cs`. O que importa:
 *  - `codigo` é a chave dos dois lados; `id` e `anexos[].id` são NÚMEROS (aqui: o número do lote
 *    e o número do anexo — os ids daqui são UUID);
 *  - cada pallet traz `destino` = o sistema que processa o lote (o MoonShot só aceita o seu);
 *  - datas de coleta/chegada em DIA (`2026-10-21`), `atualizadoEm` em instante ISO;
 *  - a planilha da Dell é o anexo do ESCOPO (`tipoAnexo.escopo`), em `.xlsx`, baixada pela
 *    `url` RELATIVA (`/api/integracao/v1/ordens/<codigo>/anexos/<numero>`).
 */

const dia = (iso: string | null) => (iso ? diaNoFuso(new Date(iso)) : null)

const INSPECAO: Record<string, string> = { bom: 'Bom', avaria: 'Avaria', outro: 'Outro' }

/** O texto original de um LocalizedText guardado em JSON. */
function original(json: string | null): string | null {
  if (!json) return null
  try {
    const t = JSON.parse(json) as { origem: string; textos: Record<string, string> }
    return t.textos[t.origem] ?? Object.values(t.textos)[0] ?? null
  } catch {
    return json
  }
}

const arredonda = (n: number) => Math.round(n * 1000) / 1000

/** Caminho do anexo no contrato (relativo, como o MoonShot exige). */
export const urlDoAnexo = (codigo: string, numero: number) =>
  `/api/integracao/v1/ordens/${encodeURIComponent(codigo)}/anexos/${numero}`

/** A ordem no contrato; null se não existe. `sistema` = quem processa (null = aqui). */
export async function ordemNoContrato(db: Db, ordemId: string) {
  const o = await db
    .selectFrom('ordensLista as o')
    .innerJoin('clientes as c', 'c.id', 'o.clienteId')
    .innerJoin('clientesSites as s', 's.id', 'o.siteId')
    .select([
      'o.id',
      'o.numero',
      'o.codigo',
      'o.status',
      'o.clienteNome',
      'o.clienteSistema',
      'o.externoSistema',
      'c.cnpj as clienteCnpj',
      's.codigo as siteCodigo',
      's.endereco as siteEndereco',
      'o.docaNumero',
      'o.dataColeta',
      'o.coletaPrevista',
      'o.dataChegada',
      'o.referenciaCliente',
      'o.escopo',
      'o.observacoes',
      'o.placa',
      'o.transportadoraNome',
      'o.motoristaNome',
      'o.qtdPallets',
      'o.qtdGaylords',
      'o.qtdRacks',
      'o.qtdBoxes',
      'o.recebidoEm',
      'o.codEmitidoEm',
      'o.processamentoEtapa',
      'o.processamentoIndice',
      'o.processamentoTotal',
      'o.devolucaoMotivo',
      'o.devolucaoPedidoPor',
      'o.devolucaoEm',
      'o.alteradoEm',
    ])
    .where('o.id', '=', ordemId)
    .executeTakeFirst()
  if (!o) return null
  const sistema = sistemaDoLote(o)

  const [recebimento, pallets, lacres, notas, anexos] = await Promise.all([
    db
      .selectFrom('ordensRecebimentos')
      .selectAll()
      .where('ordemId', '=', ordemId)
      .executeTakeFirst(),
    db
      .selectFrom('ordensPallets')
      .selectAll()
      .where('ordemId', '=', ordemId)
      .orderBy('numero')
      .execute(),
    db
      .selectFrom('ordensLacres')
      .select('numero')
      .where('ordemId', '=', ordemId)
      .orderBy('posicao')
      .execute(),
    db
      .selectFrom('ordensNotasFiscais')
      .select('numero')
      .where('ordemId', '=', ordemId)
      .orderBy('posicao')
      .execute(),
    db
      .selectFrom('ordensAnexos')
      .select(['numero', 'secao', 'tipo', 'nome', 'tamanho', 'enviadoEm'])
      .where('ordemId', '=', ordemId)
      .orderBy('enviadoEm')
      .execute(),
  ])

  const palletsContrato = pallets.map((p) => ({
    numero: p.numero,
    pesoBrutoKg: p.pesoKg,
    taraKg: p.taraKg,
    pesoLiquidoKg: p.pesoKg !== null && p.taraKg !== null ? arredonda(p.pesoKg - p.taraKg) : null,
    conteudo: p.conteudo,
    origem: p.origem,
    // O lote inteiro vai para o sistema do cliente (Dell → MoonShot, sem exceção).
    destino: sistema,
    processamentoExterno: sistema !== null,
  }))
  const bruto = pallets.reduce((s, p) => s + (p.pesoKg ?? 0), 0)
  const todasTaras = pallets.length > 0 && pallets.every((p) => p.taraKg !== null)
  const tara = pallets.reduce((s, p) => s + (p.taraKg ?? 0), 0)

  return {
    sistema,
    corpo: {
      id: o.numero,
      codigo: o.codigo,
      tipo: 'coleta',
      status: o.status,
      cliente: { nome: o.clienteNome, cnpj: o.clienteCnpj },
      site: { codigo: o.siteCodigo, endereco: o.siteEndereco },
      doca: o.docaNumero,
      localColeta: null,
      referenciaCliente: o.referenciaCliente,
      // A data da coleta: a confirmada ou, sem ela, a prevista.
      dataColeta: dia(o.dataColeta ?? o.coletaPrevista),
      coletaPrevista: dia(o.coletaPrevista),
      dataChegada: dia(o.dataChegada),
      escopoTrabalho: o.escopo,
      observacoes: o.observacoes,
      quantidades: {
        pallets: o.qtdPallets,
        gaylords: o.qtdGaylords,
        racks: o.qtdRacks,
        boxes: o.qtdBoxes,
      },
      transporte: {
        placa: o.placa,
        transportadora: o.transportadoraNome,
        motorista: o.motoristaNome,
      },
      recebimento: recebimento
        ? {
            dataRecebimento: dia(recebimento.dataRecebimento),
            recebidoEm: o.recebidoEm,
            inspecao: INSPECAO[recebimento.inspecao] ?? recebimento.inspecao,
            inspecaoObservacao: original(recebimento.inspecaoDescricao),
            lacres: lacres.map((l) => l.numero),
            notasFiscais: notas.map((n) => n.numero),
            total: {
              pallets: pallets.length,
              pesoBrutoKg: pallets.length ? arredonda(bruto) : null,
              taraKg: todasTaras ? arredonda(tara) : null,
              pesoLiquidoKg: todasTaras ? arredonda(bruto - tara) : null,
            },
            pallets: palletsContrato,
          }
        : null,
      anexos: anexos
        .filter((a) => a.numero !== null)
        .map((a) => ({
          id: a.numero,
          nome: a.nome,
          tamanho: a.tamanho,
          criadoEm: a.enviadoEm,
          secao: a.secao,
          tipoAnexo: { codigo: a.tipo, escopo: a.tipo === 'escopo' },
          url: urlDoAnexo(o.codigo, a.numero!),
        })),
      devolucao: o.devolucaoEm
        ? {
            aberta: true,
            motivo: o.devolucaoMotivo,
            pedidoPor: o.devolucaoPedidoPor,
            em: o.devolucaoEm,
          }
        : null,
      processamento: o.processamentoEtapa
        ? {
            etapa: o.processamentoEtapa,
            indice: o.processamentoIndice,
            total: o.processamentoTotal,
          }
        : null,
      codEmitidoEm: o.codEmitidoEm,
      atualizadoEm: o.alteradoEm,
    },
  }
}
