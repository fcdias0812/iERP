import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Alert } from '@/components/ui/alert'

/*
 * Cadastros › Rastreadores GPS: os aparelhos dos caminhões vêm da API de um sistema externo
 * (servidor de GPS). Pedido do usuário: "por enquanto vai ficar em branco" — a tabela já
 * mostra as colunas que virão quando a integração for ligada.
 */

interface Rastreador {
  id: string
  aparelho: string
  placa: string | null
  situacao: string
  ultimoContato: string | null
  ultimaPosicao: string | null
  viagem: string | null
}

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'aparelho', desc: false }] }
const VAZIO: Rastreador[] = []

export function AbaRastreadores() {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM)
  const colunas = useMemo<DataTableColumn<Rastreador>[]>(
    () => [
      {
        id: 'aparelho',
        header: t('cadastros.rastreadores.cols.aparelho'),
        type: 'unique-text',
        accessor: (r) => r.aparelho,
        size: 200,
        mobile: 'title',
      },
      {
        id: 'placa',
        header: t('cadastros.rastreadores.cols.placa'),
        type: 'unique-text',
        accessor: (r) => r.placa,
        size: 130,
      },
      {
        id: 'situacao',
        header: t('cadastros.rastreadores.cols.situacao'),
        type: 'enum',
        accessor: (r) => r.situacao,
        size: 150,
      },
      {
        id: 'ultimoContato',
        header: t('cadastros.rastreadores.cols.ultimoContato'),
        type: 'date',
        accessor: (r) => r.ultimoContato,
        size: 170,
      },
      {
        id: 'ultimaPosicao',
        header: t('cadastros.rastreadores.cols.ultimaPosicao'),
        type: 'unique-text',
        accessor: (r) => r.ultimaPosicao,
        size: 200,
      },
      {
        id: 'viagem',
        header: t('cadastros.rastreadores.cols.viagem'),
        type: 'unique-text',
        accessor: (r) => r.viagem,
        size: 160,
      },
    ],
    [t],
  )
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" title={t('cadastros.rastreadores.integracaoTitle')}>
        {t('cadastros.rastreadores.integracaoBody')}
      </Alert>
      <DataTable
        id="cadastros-rastreadores"
        title={t('cadastros.abas.rastreadores')}
        exportName="rastreadores-gps"
        columns={colunas}
        getRowId={(r) => r.id}
        data={VAZIO}
        query={query}
        onQueryChange={setQuery}
        empty={{
          title: t('cadastros.rastreadores.vazio'),
          description: t('cadastros.rastreadores.vazioBody'),
        }}
      />
    </div>
  )
}
