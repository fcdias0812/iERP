import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { FileDropzone } from '@/components/ui/file-upload'
import { FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCan } from '@/hooks/use-can'
import { formatBytes } from '@/lib/format'
import { urlDocumento } from '@/services/clientes'
import type { Cliente, DocumentoCliente, TipoDocumento } from '@/services/types'
import { useDocumentos, useEnviarDocumento, useRemoverDocumento } from '../use-clientes'
import { EXTENSOES_DOCUMENTO, MAX_BYTES_DOCUMENTO, TIPOS_DOCUMENTO } from './documentos'

/** Ordem inicial (sem ela, a tabela desempata pelo id interno). */
const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'enviadoEm', desc: true }] }

/** Lista vazia estável (a tabela não pode receber um array novo a cada render). */
const SEM_DOCUMENTOS: DocumentoCliente[] = []

export function AbaDocumentos({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const docs = useDocumentos(c.id)
  const enviar = useEnviarDocumento(c.id)
  const remover = useRemoverDocumento(c.id)
  const podeEnviar = useCan('clientes.editar')
  const [tipo, setTipo] = useState<TipoDocumento | ''>('')
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const [apagar, setApagar] = useState<DocumentoCliente | null>(null)
  const dropId = useId()

  const colunas = useMemo<DataTableColumn<DocumentoCliente>[]>(
    () => [
      {
        id: 'nome',
        header: t('clientes.documentos.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 320,
        mobile: 'title',
        cell: (r) => (
          <a
            href={urlDocumento(c.id, r.id)}
            download={r.nome}
            className="text-link underline-offset-4 hover:underline"
          >
            {r.nome}
          </a>
        ),
      },
      {
        id: 'tipo',
        header: t('clientes.documentos.cols.tipo'),
        type: 'enum',
        accessor: (r) => r.tipo,
        size: 150,
        options: TIPOS_DOCUMENTO.map((x) => ({
          value: x,
          label: t(`clientes.documentos.tipos.${x}`),
        })),
      },
      {
        id: 'extensao',
        header: t('clientes.documentos.cols.extensao'),
        type: 'enum',
        accessor: (r) => r.extensao,
        size: 120,
        options: EXTENSOES_DOCUMENTO.map((x) => ({ value: x, label: x.toUpperCase() })),
      },
      {
        id: 'tamanho',
        header: t('clientes.documentos.cols.tamanho'),
        type: 'number',
        accessor: (r) => r.tamanho,
        size: 120,
        cell: (r) => <span className="num">{formatBytes(r.tamanho)}</span>,
        exportValue: (r) => formatBytes(r.tamanho),
      },
      {
        id: 'enviadoEm',
        header: t('clientes.documentos.cols.enviadoEm'),
        type: 'date',
        accessor: (r) => r.enviadoEm,
        size: 140,
      },
      {
        id: 'enviadoPor',
        header: t('clientes.documentos.cols.enviadoPor'),
        type: 'unique-text',
        accessor: (r) => r.enviadoPor,
        size: 170,
      },
    ],
    [t, c.id],
  )

  return (
    <div className="flex flex-col gap-4">
      {podeEnviar && (
        <Card>
          <CardHeader>
            <CardTitle>{t('clientes.documentos.enviarTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
            <FormField label={t('clientes.documentos.cols.tipo')} required>
              {(f) => (
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
                  <SelectTrigger {...f}>
                    <SelectValue placeholder={t('clientes.documentos.escolhaTipo')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((x) => (
                      <SelectItem key={x} value={x}>
                        {t(`clientes.documentos.tipos.${x}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <div className="flex flex-col gap-1.5">
              <span className="type-label">{t('clientes.documentos.arquivos')}</span>
              <FileDropzone
                id={dropId}
                disabled={!tipo || enviar.isPending}
                accept={EXTENSOES_DOCUMENTO.map((x) => `.${x}`).join(',')}
                maxSize={MAX_BYTES_DOCUMENTO}
                onFiles={async (files) => {
                  if (!tipo) return
                  // Um por vez: cada arquivo vira um documento (e um registro no histórico).
                  for (const arquivo of files)
                    await enviar.mutateAsync({ arquivo, tipo }).catch(() => undefined)
                }}
              />
              <p className="type-caption text-muted-foreground">
                {tipo
                  ? t('clientes.documentos.ajuda', {
                      exts: EXTENSOES_DOCUMENTO.map((x) => x.toUpperCase()).join(', '),
                      max: formatBytes(MAX_BYTES_DOCUMENTO),
                    })
                  : t('clientes.documentos.escolhaTipoAntes')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        id="cliente-documentos"
        title={t('clientes.tabs.documentos')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={docs.data ?? SEM_DOCUMENTOS}
        query={query}
        onQueryChange={setQuery}
        loading={docs.isPending}
        error={docs.isError}
        onRetry={() => void docs.refetch()}
        exportName={`documentos-${c.codigo}`}
        empty={{
          title: t('clientes.documentos.vazioTitle'),
          description: t('clientes.documentos.vazioBody'),
        }}
        rowActions={(r) => (
          <>
            <DropdownMenuItem asChild>
              <a href={urlDocumento(c.id, r.id)} download={r.nome}>
                <Download aria-hidden />
                {t('clientes.documentos.baixar')}
              </a>
            </DropdownMenuItem>
            <Can permission="clientes.excluir">
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setApagar(r)}>
                  <Trash2 aria-hidden />
                  {t('common.delete')}
                </DropdownMenuItem>
              </>
            </Can>
          </>
        )}
      />

      <ConfirmDialog
        open={Boolean(apagar)}
        onOpenChange={(o) => !o && setApagar(null)}
        variant="destructive"
        title={t('clientes.documentos.apagarTitle', { name: apagar?.nome ?? '' })}
        description={t('clientes.documentos.apagarBody')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (apagar) await remover.mutateAsync({ docId: apagar.id, nome: apagar.nome })
        }}
      />
    </div>
  )
}
