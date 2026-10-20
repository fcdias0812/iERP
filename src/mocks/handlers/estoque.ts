import { http, HttpResponse } from 'msw/http'
import type {
  EstoqueDeFora,
  MaquinaDeFora,
  MaterialDeFora,
  PosicaoEcommerce,
  SistemaEstoque,
} from '@/services/types'
import { apiError, simulateNetwork } from '../config'

/*
 * API SIMULADA do Estoque (mesmo contrato de server/src/modules/estoque/estoque.ts): o armazém e
 * o Controle de Notebooks cadastrados e respondendo; o RTB WMS SEM cadastro (a tela mostra o
 * aviso "não cadastrado").
 */

const agora = () => new Date().toISOString()

const status = (codigo: string, rotulo: string, rotuloEn: string, rotuloZh: string) => ({
  codigo,
  rotulo,
  rotuloEn,
  rotuloZh,
})

const MATERIAIS: MaterialDeFora[] = [
  {
    id: 'armazem:LOT-20261010-0001',
    lote: 'LOT-20261010-0001',
    palete: 'P-0001',
    categoriaNegocio: 'ITAD',
    origem: 'Coleta Dell',
    cliente: 'Dell',
    projeto: null,
    tipoMercadoria: 'Notebooks',
    categoriaProduto: 'Informática',
    quantidade: 24,
    quantidadeEstimada: false,
    pesoKg: 312.5,
    statusFisico: status('FUNCIONANDO', 'Funcionando', 'Working', '運作中'),
    statusVenda: status('VENDAVEL', 'Vendável', 'Sellable', '可銷售'),
    area: 'Área A',
    posicao: 'A-01',
    dataEntrada: '2026-10-10T13:00:00.000Z',
    itens: 24,
    fotos: 3,
  },
  {
    id: 'armazem:LOT-20261012-0003',
    lote: 'LOT-20261012-0003',
    palete: 'P-0003',
    categoriaNegocio: 'EWASTE',
    origem: 'Coleta Microsoft',
    cliente: 'Microsoft',
    projeto: 'Datacenter SP',
    tipoMercadoria: 'Cabos e fontes',
    categoriaProduto: 'Sucata eletrônica',
    quantidade: 120,
    quantidadeEstimada: true,
    pesoKg: 480,
    statusFisico: status('COM_DEFEITO', 'Com defeito', 'Defective', '有缺陷'),
    statusVenda: status('NAO_VENDAVEL', 'Não vendável', 'Not sellable', '不可銷售'),
    area: 'Área B',
    posicao: 'B-07',
    dataEntrada: '2026-10-12T15:30:00.000Z',
    itens: 1,
    fotos: 0,
  },
]

const maquina = (
  serial: string,
  tipo: string,
  modelo: string,
  st: [number, string],
  extra: Partial<MaquinaDeFora> = {},
): MaquinaDeFora => ({
  id: `notebooks:${serial}`,
  serial,
  semSerial: false,
  tipo,
  marca: 'Dell',
  modelo,
  grade: 'A',
  cor: null,
  cpu: tipo === 'Peça' ? null : 'i5-1145G7',
  memoria: tipo === 'Peça' ? null : '16GB',
  disco: tipo === 'Peça' ? null : '256GB',
  tela: null,
  gpu: null,
  so: tipo === 'Peça' ? null : 'Windows 11',
  acessorios: null,
  resumo: null,
  status: { codigo: st[0], nome: st[1] },
  preparo: { codigo: 2, nome: 'Pronto para e-commerce' },
  lote: 'Lote 7',
  dataEntrada: '2026-10-01',
  dataTriagem: '2026-10-02',
  link: `http://localhost:5012/Computadores?Busca=${serial}`,
  ...extra,
})

const MAQUINAS: MaquinaDeFora[] = [
  maquina('5CG1234XYZ', 'Notebook', 'Latitude 5420', [2, 'Pronto para venda']),
  maquina('SRV-0001', 'Servidor', 'PowerEdge R640', [8, 'Manutenção'], { grade: 'B' }),
  maquina('PCA-0099', 'Peça', 'Tela 14" FHD', [1, 'Recebido'], { grade: null }),
]

function resposta<T>(sistema: SistemaEstoque, nome: string, linhas: T[], url: string) {
  const r: EstoqueDeFora<T> = {
    sistema,
    nome,
    configurado: true,
    indisponivel: false,
    motivo: null,
    detalhe: null,
    linhas,
    total: linhas.length,
    incompleto: false,
    urlSistema: url,
    lidoEm: agora(),
  }
  return r
}

const ehPeca = (m: MaquinaDeFora) => m.tipo === 'Peça'

export const estoqueHandlers = [
  http.get('*/api/estoque/:aba', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    switch (params.aba) {
      case 'materiais':
        return HttpResponse.json(
          resposta(
            'ARMAZEM',
            'Armazém (Inventory-Management)',
            MATERIAIS,
            'http://localhost:4000/',
          ),
        )
      case 'assets':
      case 'pecas':
        return HttpResponse.json(
          resposta(
            'NOTEBOOKS',
            'Controle de Notebooks',
            MAQUINAS.filter((m) => ehPeca(m) === (params.aba === 'pecas')),
            'http://localhost:5012/Computadores',
          ),
        )
      case 'ecommerce': {
        const r: EstoqueDeFora<PosicaoEcommerce> = {
          ...resposta<PosicaoEcommerce>('RTB_WMS', 'RTB WMS (e-commerce)', [], ''),
          configurado: false,
          indisponivel: true,
          motivo: 'nao_configurado',
          urlSistema: null,
        }
        return HttpResponse.json(r)
      }
      default:
        return apiError(422, 'validation', 'Tela do estoque desconhecida.')
    }
  }),
]
