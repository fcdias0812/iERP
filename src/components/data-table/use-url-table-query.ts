import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { queryToSearch, searchToQuery, type TableSearch } from './url-state'
import type { DataTableColumn, TableQuery } from './types'

/**
 * Estado da tabela na URL. A rota precisa declarar `validateSearch: tableSearchSchema`.
 * Retorna [query, setQuery] para passar ao <DataTable query onQueryChange />.
 */
export function useUrlTableQuery<T>(columns: DataTableColumn<T>[]) {
  const search = useSearch({ strict: false }) as TableSearch
  const navigate = useNavigate()
  const types = useMemo(() => Object.fromEntries(columns.map((c) => [c.id, c.type])), [columns])
  const query = useMemo(() => searchToQuery(search, types), [search, types])
  const setQuery = useCallback(
    (next: TableQuery) => {
      // replace: filtrar não deve encher o histórico do "voltar".
      void navigate({ to: '.', search: queryToSearch(next) as never, replace: true })
    },
    [navigate],
  )
  return [query, setQuery] as const
}
