import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataTableColumn } from '@/components/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { EMPTY, formatNumber } from '@/lib/format'
import type { MaquinaDeFora, MaterialDeFora, PosicaoEcommerce } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { EstoqueDeFora } from './EstoqueDeFora'
import {
  diaParaInstante,
  rotuloDeFora,
  STATUS_MAQUINA,
  tomFisico,
  tomMaquina,
  tomVenda,
} from './tons'

/*
 * As telas do Estoque que vêm de fora: Materiais (armazém), Assets e Peças (Controle de Notebooks)
 * e E-commerce (RTB WMS). Colunas pelos campos que cada sistema manda; listas fechadas de lá
 * (tipo, categoria do negócio, status e preparo da máquina) traduzidas aqui; nomes, modelos e
 * códigos ficam como lá. Os filtros das colunas de lista oferecem os valores que vieram (o
 * cadastro de lá é livre e muda), e os estados filtram e buscam pelo RÓTULO que a tela mostra.
 */

/** Opções de filtro a partir dos valores que vieram. */
function opcoesDe<T>(linhas: T[], valor: (l: T) => string | null, rotulo?: (v: string) => string) {
  const vistos = new Set<string>()
  for (const l of linhas) {
    const v = valor(l)
    if (v) vistos.add(v)
  }
  return [...vistos]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((v) => ({ value: v, label: rotulo ? rotulo(v) : v }))
}

/** Põe as colunas na ordem dada (as que não estão na lista vão para o fim, como vieram). */
function naOrdem<T>(colunas: DataTableColumn<T>[], ordem: string[]) {
  const pos = (id: string) => {
    const i = ordem.indexOf(id)
    return i < 0 ? ordem.length : i
  }
  return [...colunas].sort((x, y) => pos(x.id) - pos(y.id))
}

/** Coluna de lista com os valores de lá (filtro com o que veio). */
function lista<T>(
  linhas: T[],
  c: Omit<DataTableColumn<T>, 'type' | 'options' | 'accessor'> & {
    accessor: (r: T) => string | null
  },
): DataTableColumn<T> {
  return { ...c, type: 'enum', options: opcoesDe(linhas, c.accessor) }
}

const mono = (v: string | null) => (v ? <span className="font-mono">{v}</span> : EMPTY)

/* ------------------------------------------------------------ Materiais (armazém) */

const CATEGORIAS_NEGOCIO = ['ECOMMERCE', 'ITAD', 'PROJETO', 'PECAS', 'EWASTE']
/** O que se procura primeiro: o lote e em que pé ele está. */
const ORDEM_MATERIAIS = [
  'lote',
  'statusFisico',
  'statusVenda',
  'categoriaNegocio',
  'tipoMercadoria',
  'categoriaProduto',
  'cliente',
  'quantidade',
  'pesoKg',
  'area',
  'posicao',
  'dataEntrada',
  'palete',
]

export function MateriaisPage() {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const montar = useCallback(
    (linhas: MaterialDeFora[]): DataTableColumn<MaterialDeFora>[] => {
      const categoria = (c: string) =>
        CATEGORIAS_NEGOCIO.includes(c) ? t(`estoque.categoriasNegocio.${c as 'ITAD'}`) : c
      const fisico = (r: MaterialDeFora) =>
        r.statusFisico ? rotuloDeFora(r.statusFisico, idioma) : null
      const venda = (r: MaterialDeFora) =>
        r.statusVenda ? rotuloDeFora(r.statusVenda, idioma) : null
      return naOrdem<MaterialDeFora>(
        [
          {
            id: 'lote',
            header: t('estoque.cols.lote'),
            type: 'unique-text',
            accessor: (r) => r.lote,
            size: 190,
            mobile: 'title',
            cell: (r) => mono(r.lote),
          },
          {
            id: 'palete',
            header: t('estoque.cols.palete'),
            type: 'unique-text',
            accessor: (r) => r.palete,
            size: 120,
            cell: (r) => mono(r.palete),
          },
          {
            id: 'categoriaNegocio',
            header: t('estoque.cols.categoriaNegocio'),
            type: 'enum',
            accessor: (r) => r.categoriaNegocio,
            size: 150,
            options: opcoesDe(linhas, (r) => r.categoriaNegocio, categoria),
            cell: (r) => (r.categoriaNegocio ? categoria(r.categoriaNegocio) : EMPTY),
            exportValue: (r) => (r.categoriaNegocio ? categoria(r.categoriaNegocio) : null),
          },
          {
            id: 'tipoMercadoria',
            header: t('estoque.cols.tipoMercadoria'),
            type: 'unique-text',
            accessor: (r) => r.tipoMercadoria,
            size: 200,
          },
          lista(linhas, {
            id: 'categoriaProduto',
            header: t('estoque.cols.categoriaProduto'),
            accessor: (r) => r.categoriaProduto,
            size: 160,
          }),
          lista(linhas, {
            id: 'cliente',
            header: t('estoque.cols.cliente'),
            accessor: (r) => r.cliente,
            size: 160,
          }),
          {
            id: 'quantidade',
            header: t('estoque.cols.quantidade'),
            type: 'number',
            accessor: (r) => r.quantidade,
            size: 120,
            total: true,
            cell: (r) => (
              <span
                className="num"
                title={r.quantidadeEstimada ? t('estoque.estimada') : undefined}
              >
                {r.quantidadeEstimada && '~'}
                {formatNumber(r.quantidade)}
              </span>
            ),
          },
          {
            id: 'pesoKg',
            header: t('estoque.cols.pesoKg'),
            type: 'number',
            accessor: (r) => r.pesoKg,
            size: 120,
            total: true,
          },
          {
            ...lista(linhas, {
              id: 'statusFisico',
              header: t('estoque.cols.statusFisico'),
              accessor: fisico,
              size: 190,
              mobile: 'badge',
            }),
            cell: (r) =>
              r.statusFisico ? (
                <StatusBadge
                  status={tomFisico(r.statusFisico.codigo)}
                  label={fisico(r)!}
                  size="sm"
                />
              ) : (
                EMPTY
              ),
          },
          {
            ...lista(linhas, {
              id: 'statusVenda',
              header: t('estoque.cols.statusVenda'),
              accessor: venda,
              size: 180,
            }),
            cell: (r) =>
              r.statusVenda ? (
                <StatusBadge status={tomVenda(r.statusVenda.codigo)} label={venda(r)!} size="sm" />
              ) : (
                EMPTY
              ),
          },
          lista(linhas, {
            id: 'area',
            header: t('estoque.cols.area'),
            accessor: (r) => r.area,
            size: 140,
          }),
          {
            id: 'posicao',
            header: t('estoque.cols.posicao'),
            type: 'unique-text',
            accessor: (r) => r.posicao,
            size: 110,
            cell: (r) => mono(r.posicao),
          },
          {
            id: 'dataEntrada',
            header: t('estoque.cols.dataEntrada'),
            type: 'date',
            accessor: (r) => r.dataEntrada,
            size: 140,
          },
          {
            id: 'projeto',
            header: t('estoque.cols.projeto'),
            type: 'unique-text',
            accessor: (r) => r.projeto,
            size: 160,
            hidden: true,
          },
          {
            id: 'origem',
            header: t('estoque.cols.origem'),
            type: 'unique-text',
            accessor: (r) => r.origem,
            size: 160,
            hidden: true,
          },
          {
            id: 'fotos',
            header: t('estoque.cols.fotos'),
            type: 'number',
            accessor: (r) => r.fotos,
            size: 100,
            hidden: true,
          },
        ],
        ORDEM_MATERIAIS,
      )
    },
    [t, idioma],
  )
  return (
    <EstoqueDeFora
      aba="materiais"
      montarColunas={montar}
      ordem={[{ id: 'dataEntrada', desc: true }]}
    />
  )
}

/* ------------------------------------------------------------ Assets e Peças (Notebooks) */

const TIPOS = ['Notebook', 'Desktop', 'AIO', 'Servidor']

function useColunasMaquina(pecas: boolean) {
  const { t } = useTranslation()
  return useCallback(
    (linhas: MaquinaDeFora[]): DataTableColumn<MaquinaDeFora>[] => {
      const status = (m: MaquinaDeFora) =>
        m.status
          ? STATUS_MAQUINA.includes(m.status.codigo)
            ? t(`estoque.statusMaquina.${m.status.codigo as 1}`)
            : m.status.nome
          : null
      const preparo = (m: MaquinaDeFora) =>
        m.preparo
          ? [1, 2, 3, 4].includes(m.preparo.codigo)
            ? t(`estoque.preparo.${m.preparo.codigo as 1}`)
            : m.preparo.nome
          : null
      const tipo = (v: string) => (TIPOS.includes(v) ? t(`estoque.tipos.${v as 'AIO'}`) : v)
      const todas: (DataTableColumn<MaquinaDeFora> | false)[] = [
        {
          id: 'serial',
          header: t('estoque.cols.serial'),
          type: 'unique-text',
          accessor: (r) => r.serial,
          size: 180,
          mobile: 'title',
          cell: (r) => (
            <span className="font-mono" title={r.semSerial ? t('estoque.semSerial') : undefined}>
              {r.serial}
            </span>
          ),
        },
        !pecas && {
          id: 'tipo',
          header: t('estoque.cols.tipo'),
          type: 'enum',
          accessor: (r) => r.tipo,
          size: 120,
          options: opcoesDe(linhas, (r) => r.tipo, tipo),
          cell: (r) => (r.tipo ? tipo(r.tipo) : EMPTY),
          exportValue: (r) => (r.tipo ? tipo(r.tipo) : null),
        },
        lista(linhas, {
          id: 'marca',
          header: t('estoque.cols.marca'),
          accessor: (r) => r.marca,
          size: 120,
        }),
        {
          id: 'modelo',
          header: pecas ? t('estoque.cols.descricaoPeca') : t('estoque.cols.modelo'),
          type: 'unique-text',
          accessor: (r) => (pecas ? (r.modelo ?? r.resumo) : r.modelo),
          size: 220,
        },
        !pecas &&
          lista(linhas, {
            id: 'grade',
            header: t('estoque.cols.grade'),
            accessor: (r) => r.grade,
            size: 90,
          }),
        !pecas && {
          id: 'cpu',
          header: t('estoque.cols.cpu'),
          type: 'unique-text',
          accessor: (r) => r.cpu,
          size: 160,
        },
        !pecas &&
          lista(linhas, {
            id: 'memoria',
            header: t('estoque.cols.memoria'),
            accessor: (r) => r.memoria,
            size: 110,
          }),
        !pecas &&
          lista(linhas, {
            id: 'disco',
            header: t('estoque.cols.disco'),
            accessor: (r) => r.disco,
            size: 110,
          }),
        {
          ...lista(linhas, {
            id: 'status',
            header: t('estoque.cols.status'),
            accessor: status,
            size: 190,
            mobile: 'badge',
          }),
          cell: (r) =>
            r.status ? (
              <StatusBadge status={tomMaquina(r.status.codigo)} label={status(r)!} size="sm" />
            ) : (
              EMPTY
            ),
        },
        lista(linhas, {
          id: 'preparo',
          header: t('estoque.cols.preparo'),
          accessor: preparo,
          size: 190,
        }),
        lista(linhas, {
          id: 'lote',
          header: t('estoque.cols.loteDeLa'),
          accessor: (r) => r.lote,
          size: 140,
        }),
        {
          id: 'dataEntrada',
          header: t('estoque.cols.dataEntrada'),
          type: 'date',
          accessor: (r) => diaParaInstante(r.dataEntrada),
          size: 140,
        },
        {
          id: 'dataTriagem',
          header: t('estoque.cols.dataTriagem'),
          type: 'date',
          accessor: (r) => diaParaInstante(r.dataTriagem),
          size: 140,
          hidden: true,
        },
        !pecas && {
          id: 'resumo',
          header: t('estoque.cols.resumo'),
          type: 'unique-text',
          accessor: (r) => r.resumo,
          size: 220,
          hidden: true,
        },
        !pecas && {
          ...lista(linhas, {
            id: 'so',
            header: t('estoque.cols.so'),
            accessor: (r) => r.so,
            size: 140,
          }),
          hidden: true,
        },
      ]
      return naOrdem(
        todas.filter((c): c is DataTableColumn<MaquinaDeFora> => Boolean(c)),
        ['serial', 'status', 'tipo', 'marca', 'modelo'],
      )
    },
    [t, pecas],
  )
}

const linkDaMaquina = (m: MaquinaDeFora) => m.link

export function AssetsPage() {
  const montar = useColunasMaquina(false)
  return (
    <EstoqueDeFora
      aba="assets"
      montarColunas={montar}
      ordem={[{ id: 'dataEntrada', desc: true }]}
      linkDaLinha={linkDaMaquina}
    />
  )
}

export function PecasPage() {
  const montar = useColunasMaquina(true)
  return (
    <EstoqueDeFora
      aba="pecas"
      montarColunas={montar}
      ordem={[{ id: 'dataEntrada', desc: true }]}
      linkDaLinha={linkDaMaquina}
    />
  )
}

/* ------------------------------------------------------------ E-commerce (RTB WMS) */

export function EcommercePage() {
  const { t } = useTranslation()
  const montar = useCallback(
    (linhas: PosicaoEcommerce[]): DataTableColumn<PosicaoEcommerce>[] => {
      const zona = (z: string | null) => (z === '*' ? t('estoque.zonaGeral') : z)
      return naOrdem<PosicaoEcommerce>(
        [
          {
            id: 'sku',
            header: t('estoque.cols.sku'),
            type: 'unique-text',
            accessor: (r) => r.sku,
            size: 160,
            mobile: 'title',
            cell: (r) => mono(r.sku),
          },
          {
            id: 'descricao',
            header: t('estoque.cols.produto'),
            type: 'unique-text',
            accessor: (r) => r.descricao,
            size: 260,
          },
          lista(linhas, {
            id: 'cor',
            header: t('estoque.cols.cor'),
            accessor: (r) => r.cor,
            size: 110,
          }),
          {
            id: 'posicao',
            header: t('estoque.cols.posicao'),
            type: 'unique-text',
            accessor: (r) => r.posicao,
            size: 110,
            cell: (r) => mono(r.posicao),
          },
          {
            id: 'apelido',
            header: t('estoque.cols.apelido'),
            type: 'unique-text',
            accessor: (r) => r.apelido,
            size: 110,
            cell: (r) => mono(r.apelido),
          },
          lista(linhas, {
            id: 'zona',
            header: t('estoque.cols.zona'),
            accessor: (r) => zona(r.zona),
            size: 100,
          }),
          lista(linhas, {
            id: 'categoria',
            header: t('estoque.cols.categoriaPosicao'),
            accessor: (r) => r.categoria,
            size: 150,
          }),
          {
            id: 'quantidade',
            header: t('estoque.cols.quantidade'),
            type: 'number',
            accessor: (r) => r.quantidade,
            size: 120,
            total: true,
          },
          {
            id: 'produtoAtivo',
            header: t('estoque.cols.produtoAtivo'),
            type: 'boolean',
            accessor: (r) => r.produtoAtivo,
            size: 130,
            cell: (r) =>
              r.produtoAtivo === false ? (
                <StatusBadge
                  status="estoque_encerrado"
                  label={t('estoque.produtoInativo')}
                  size="sm"
                />
              ) : r.produtoAtivo ? (
                t('dataTable.yes')
              ) : (
                EMPTY
              ),
          },
          {
            id: 'ultimaEntrada',
            header: t('estoque.cols.ultimaEntrada'),
            type: 'date',
            accessor: (r) => r.ultimaEntrada,
            size: 150,
          },
        ],
        ['sku', 'descricao', 'quantidade', 'posicao', 'zona'],
      )
    },
    [t],
  )
  return (
    <EstoqueDeFora
      aba="ecommerce"
      montarColunas={montar}
      ordem={[{ id: 'posicao', desc: false }]}
    />
  )
}
