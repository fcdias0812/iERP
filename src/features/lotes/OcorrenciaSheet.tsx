import { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Undo2, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/ui/file-upload'
import { RhfField } from '@/components/ui/form'
import { SeletorIdiomaTexto } from '@/components/ui/localized-text'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { useSalvarOcorrencia } from '@/features/ordens/use-ordens'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { formatBytes } from '@/lib/format'
import { textoOriginal } from '@/lib/localized-text'
import { cn } from '@/lib/utils'
import { urlFotoOcorrencia } from '@/services/ordens'
import type { CategoriaOcorrencia, MomentoOcorrencia, Ordem } from '@/services/types'
import {
  CATEGORIAS,
  EXTENSOES_FOTO,
  MAX_BYTES_FOTO,
  MAX_FOTOS,
  MAX_TEXTO,
  MOMENTOS,
  ocorrenciaSchema,
  type OcorrenciaForm,
} from './ocorrencia'

/*
 * Registrar / corrigir ocorrência do lote (painel lateral, padrão de cadastro). O texto é
 * traduzido para os 3 idiomas ao salvar (idioma detectado do que a pessoa escreve). Fotos:
 * novas entram no envio; as que já existem podem ser marcadas para remover.
 */
export function OcorrenciaSheet({
  lote,
  ocorrenciaId,
  permissao,
  onClose,
}: {
  lote: Ordem
  /** null = nova ocorrência. */
  ocorrenciaId: string | null
  permissao: string
  onClose: () => void
}) {
  const oc = ocorrenciaId ? lote.ocorrencias.find((x) => x.id === ocorrenciaId) : undefined
  // Endereço com ocorrência inexistente ou cancelada (não se corrige): fecha o painel.
  const invalida = ocorrenciaId !== null && (!oc || oc.status !== 'registrada')
  useEffect(() => {
    if (invalida) onClose()
  }, [invalida, onClose])
  if (invalida) return null
  return <Formulario lote={lote} oc={oc} permissao={permissao} onClose={onClose} />
}

function Formulario({
  lote,
  oc,
  permissao,
  onClose,
}: {
  lote: Ordem
  oc: Ordem['ocorrencias'][number] | undefined
  permissao: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = useSalvarOcorrencia(lote.id)
  const traducao = useTraducao()
  const dropId = useId()
  const [novas, setNovas] = useState<File[]>([])
  const [remover, setRemover] = useState<string[]>([])
  const form = useForm<OcorrenciaForm>({
    resolver: zodResolver(ocorrenciaSchema),
    mode: 'onTouched',
    defaultValues: oc
      ? { momento: oc.momento, categoria: oc.categoria, texto: textoOriginal(oc.texto) }
      : {
          momento: undefined as unknown as MomentoOcorrencia,
          categoria: undefined as unknown as CategoriaOcorrencia,
          texto: '',
        },
  })
  const texto = useWatch({ control: form.control, name: 'texto' }) ?? ''
  const idioma = useIdiomaTexto(texto, oc?.texto.origem)
  const existentes = oc?.fotos ?? []
  const totalFotos = existentes.length - remover.length + novas.length

  // Prévia das fotos novas (o endereço temporário é liberado ao sair).
  const previas = useMemo(() => novas.map((f) => URL.createObjectURL(f)), [novas])
  useEffect(() => () => previas.forEach((u) => URL.revokeObjectURL(u)), [previas])

  const enviar = form.handleSubmit(async (v) => {
    const original = v.texto.trim()
    const mesmoTexto =
      oc && original === textoOriginal(oc.texto).trim() && idioma.idioma === oc.texto.origem
    const textoTraduzido = mesmoTexto ? oc.texto : await traducao.traduzir(original, idioma.idioma)
    const salvo = await salvar
      .mutateAsync({
        ocorrenciaId: oc?.id,
        dados: {
          momento: v.momento,
          categoria: v.categoria,
          texto: textoTraduzido,
          ...(oc ? { removerFotos: remover } : {}),
        },
        fotos: novas,
      })
      .catch(() => null)
    if (salvo) {
      form.reset(form.getValues())
      setNovas([])
      setRemover([])
      onClose()
    }
  })

  const adicionar = (files: File[]) => {
    const vagas = MAX_FOTOS - totalFotos
    setNovas((atual) => [...atual, ...files.slice(0, Math.max(0, vagas))])
  }

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={
        oc
          ? t('lotes.ocorrencias.editTitle', { numero: oc.numero })
          : t('lotes.ocorrencias.newTitle')
      }
      descricao={t('lotes.ocorrencias.formDescription', { code: lote.codigo })}
      status={oc ? <StatusBadge status={oc.status} /> : undefined}
      formId="form-ocorrencia"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty || novas.length > 0 || remover.length > 0}
      permissao={permissao}
      dados={
        <form
          id="form-ocorrencia"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <CadastroSecao titulo={t('lotes.ocorrencias.secoes.oque')}>
            <RhfField
              control={form.control}
              name="momento"
              label={t('lotes.ocorrencias.cols.momento')}
              required
            >
              {({ field, control }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger {...control} onBlur={field.onBlur}>
                    <SelectValue placeholder={t('lotes.ocorrencias.escolhaMomento')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MOMENTOS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`lotes.ocorrencias.momentos.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name="categoria"
              label={t('lotes.ocorrencias.cols.categoria')}
              required
            >
              {({ field, control }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger {...control} onBlur={field.onBlur}>
                    <SelectValue placeholder={t('lotes.ocorrencias.escolhaCategoria')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`lotes.ocorrencias.categorias.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <RhfField
                control={form.control}
                name="texto"
                label={t('lotes.ocorrencias.cols.texto')}
                help={t('lotes.ocorrencias.textoAjuda')}
                maxLength={MAX_TEXTO}
                required
              >
                {({ field, control }) => (
                  <Textarea {...control} {...field} rows={5} maxLength={MAX_TEXTO} />
                )}
              </RhfField>
              <SeletorIdiomaTexto
                texto={texto}
                idioma={idioma.idioma}
                detectado={idioma.detectado}
                onChange={idioma.definir}
              />
            </div>
          </CadastroSecao>

          <CadastroSecao
            titulo={t('lotes.ocorrencias.secoes.fotos')}
            descricao={t('lotes.ocorrencias.fotosAjuda', {
              exts: EXTENSOES_FOTO.map((x) => x.toUpperCase()).join(', '),
              max: formatBytes(MAX_BYTES_FOTO),
              n: MAX_FOTOS,
            })}
            colunas={1}
          >
            {(existentes.length > 0 || novas.length > 0) && (
              <ul
                aria-label={t('lotes.ocorrencias.fotosDaOcorrencia')}
                className="flex flex-wrap gap-3"
              >
                {existentes.map((f) => {
                  const sai = remover.includes(f.id)
                  return (
                    <li key={f.id} className="flex w-24 flex-col items-center gap-1">
                      <img
                        src={urlFotoOcorrencia(lote.id, oc!.id, f.id)}
                        alt={f.nome}
                        className={cn(
                          'size-24 rounded-sm border object-cover',
                          sai && 'opacity-40 grayscale',
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRemover((r) => (sai ? r.filter((x) => x !== f.id) : [...r, f.id]))
                        }
                      >
                        {sai ? <Undo2 aria-hidden /> : <X aria-hidden />}
                        {sai
                          ? t('lotes.ocorrencias.manterFoto')
                          : t('lotes.ocorrencias.removerFoto')}
                        <span className="sr-only">{f.nome}</span>
                      </Button>
                    </li>
                  )
                })}
                {novas.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex w-24 flex-col items-center gap-1">
                    <img
                      src={previas[i]}
                      alt={f.name}
                      className="size-24 rounded-sm border object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNovas((n) => n.filter((_, j) => j !== i))}
                    >
                      <X aria-hidden />
                      {t('lotes.ocorrencias.removerFoto')}
                      <span className="sr-only">{f.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {totalFotos < MAX_FOTOS ? (
              <FileDropzone
                id={dropId}
                accept={EXTENSOES_FOTO.map((x) => `.${x}`).join(',')}
                maxSize={MAX_BYTES_FOTO}
                onFiles={adicionar}
              />
            ) : (
              <Alert tone="info" title={t('lotes.ocorrencias.limiteFotos', { n: MAX_FOTOS })} />
            )}
          </CadastroSecao>
        </form>
      }
    />
  )
}
