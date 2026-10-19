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
import { EXTENSOES_DOCUMENTO, MAX_BYTES_DOCUMENTO } from '@/features/clientes/detalhe/documentos'
import { useAdicionarDocumentos, useRemoverDocumento } from '@/features/ordens/use-ordens'
import { useCan } from '@/hooks/use-can'
import { formatBytes, formatDateTime } from '@/lib/format'
import { urlAnexoOrdem } from '@/services/ordens'
import type { AnexoOrdem, Ordem, SecaoAnexo, TipoDocumentoLote } from '@/services/types'

/*
 * Documentos do lote: os enviados no agendamento (escopo de trabalho, observações) e os
 * adicionados depois, aqui mesmo — cada um com TIPO (como em Clientes). Remover pede
 * confirmação e fica no histórico; o único escopo (sem texto) não pode sair.
 */

const TIPOS_DOCUMENTO_LOTE: TipoDocumentoLote[] = [
  'escopo',
  'nota_fiscal',
  'mtr',
  'cdf',
  'foto',
  'outro',
]

const ORDEM_INICIAL: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'enviadoEm', desc: true }] }
const SEM_DOCUMENTOS: AnexoOrdem[] = []
const SECOES: SecaoAnexo[] = ['escopo', 'observacoes', 'lote']

export function AbaDocumentosLote({
  o,
  permissao,
  permissaoExcluir,
}: {
  o: Ordem
  permissao: string
  permissaoExcluir: string
}) {
  const { t } = useTranslation()
  const enviar = useAdicionarDocumentos(o.id)
  const remover = useRemoverDocumento(o.id)
  const podeEnviar = useCan(permissao)
  const [tipo, setTipo] = useState<TipoDocumentoLote | ''>('')
  const [query, setQuery] = useState<TableQuery>(ORDEM_INICIAL)
  const [apagar, setApagar] = useState<AnexoOrdem | null>(null)
  const dropId = useId()
  const autores = useMemo(() => [...new Set(o.anexos.map((a) => a.enviadoPor))].sort(), [o.anexos])

  const colunas = useMemo<DataTableColumn<AnexoOrdem>[]>(
    () => [
      {
        id: 'nome',
        header: t('lotes.documentos.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 300,
        mobile: 'title',
        cell: (r) => (
          <a
            href={urlAnexoOrdem(o.id, r.id)}
            download={r.nome}
            className="text-link underline-offset-4 hover:underline"
          >
            {r.nome}
          </a>
        ),
      },
      {
        id: 'tipo',
        header: t('lotes.documentos.cols.tipo'),
        type: 'enum',
        accessor: (r) => r.tipo,
        size: 210,
        options: TIPOS_DOCUMENTO_LOTE.map((x) => ({
          value: x,
          label: t(`lotes.documentos.tipos.${x}`),
        })),
      },
      {
        id: 'secao',
        header: t('lotes.documentos.cols.secao'),
        type: 'enum',
        accessor: (r) => r.secao,
        size: 230,
        options: SECOES.map((s) => ({ value: s, label: t(`lotes.documentos.secoes.${s}`) })),
      },
      {
        id: 'extensao',
        header: t('lotes.documentos.cols.extensao'),
        type: 'enum',
        accessor: (r) => r.extensao,
        size: 110,
        hidden: true,
        options: EXTENSOES_DOCUMENTO.map((x) => ({ value: x, label: x.toUpperCase() })),
      },
      {
        id: 'tamanho',
        header: t('lotes.documentos.cols.tamanho'),
        type: 'number',
        accessor: (r) => r.tamanho,
        size: 120,
        cell: (r) => <span className="num">{formatBytes(r.tamanho)}</span>,
        exportValue: (r) => formatBytes(r.tamanho),
      },
      {
        id: 'enviadoEm',
        header: t('lotes.documentos.cols.enviadoEm'),
        type: 'date',
        accessor: (r) => r.enviadoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.enviadoEm)}</span>,
        exportValue: (r) => formatDateTime(r.enviadoEm),
      },
      {
        id: 'enviadoPor',
        header: t('lotes.documentos.cols.enviadoPor'),
        type: 'enum',
        accessor: (r) => r.enviadoPor,
        size: 170,
        options: autores.map((a) => ({ value: a, label: a })),
      },
    ],
    [t, o.id, autores],
  )

  return (
    <div className="flex flex-col gap-4">
      {podeEnviar && (
        <Card>
          <CardHeader>
            <CardTitle>{t('lotes.documentos.adicionarTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
            <FormField label={t('lotes.documentos.cols.tipo')} required>
              {(f) => (
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumentoLote)}>
                  <SelectTrigger {...f}>
                    <SelectValue placeholder={t('lotes.documentos.escolhaTipo')} />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO_LOTE.map((x) => (
                      <SelectItem key={x} value={x}>
                        {t(`lotes.documentos.tipos.${x}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <div className="flex flex-col gap-1.5">
              <span className="type-label">{t('ordens.agendamento.campos.arquivos')}</span>
              <FileDropzone
                id={dropId}
                disabled={!tipo || enviar.isPending}
                accept={EXTENSOES_DOCUMENTO.map((x) => `.${x}`).join(',')}
                maxSize={MAX_BYTES_DOCUMENTO}
                onFiles={(arquivos) => {
                  if (tipo) void enviar.mutateAsync({ tipo, arquivos }).catch(() => undefined)
                }}
              />
              <p className="type-caption text-muted-foreground">
                {tipo
                  ? t('lotes.documentos.ajuda', {
                      exts: EXTENSOES_DOCUMENTO.map((x) => x.toUpperCase()).join(', '),
                      max: formatBytes(MAX_BYTES_DOCUMENTO),
                    })
                  : t('lotes.documentos.escolhaTipoAntes')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        id="lote-documentos"
        title={t('lotes.abas.documentos')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={o.anexos.length ? o.anexos : SEM_DOCUMENTOS}
        query={query}
        onQueryChange={setQuery}
        exportName={`documentos-${o.codigo}`}
        empty={{
          title: t('lotes.documentos.vazioTitle'),
          description: t('lotes.documentos.vazioBody'),
        }}
        rowActions={(r) => (
          <>
            <DropdownMenuItem asChild>
              <a href={urlAnexoOrdem(o.id, r.id)} download={r.nome}>
                <Download aria-hidden />
                {t('lotes.documentos.baixar')}
              </a>
            </DropdownMenuItem>
            <Can permission={permissaoExcluir}>
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setApagar(r)}>
                  <Trash2 aria-hidden />
                  {t('lotes.documentos.remover')}
                </DropdownMenuItem>
              </>
            </Can>
          </>
        )}
      />

      <ConfirmDialog
        open={Boolean(apagar)}
        onOpenChange={(aberto) => !aberto && setApagar(null)}
        variant="destructive"
        title={t('lotes.documentos.removerTitle', { name: apagar?.nome ?? '' })}
        description={t('lotes.documentos.removerBody')}
        confirmLabel={t('lotes.documentos.remover')}
        onConfirm={async () => {
          if (apagar) await remover.mutateAsync({ anexoId: apagar.id, nome: apagar.nome })
        }}
      />
    </div>
  )
}
