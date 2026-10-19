import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleMinus, ClipboardList, History, Save } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Kbd } from '@/components/ui/kbd'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isMac, useHotkey } from '@/hooks/use-hotkey'
import { cn } from '@/lib/utils'
import type { AcaoCadastro } from '@/services/types'

/*
 * PADRÃO DE CADASTRO do iERP: todo cadastro e edição abre neste painel lateral (direita), sem
 * trocar de tela — Clientes, Transportadoras, Motoristas, Veículos. Ctrl+S salva. Opcional:
 * abas Dados | Histórico e Inativar/Reativar (cadastros sem página de detalhe). Fechar com
 * alterações não salvas pede confirmação.
 */

/** Seção do formulário dentro do painel (título, ajuda e campos em grade). */
export function CadastroSecao({
  titulo,
  descricao,
  colunas = 2,
  children,
}: {
  titulo: string
  descricao?: string
  colunas?: 1 | 2
  children: ReactNode
}) {
  return (
    <fieldset
      className={cn(
        'grid min-w-0 grid-cols-1 items-start gap-4',
        colunas === 2 && 'sm:grid-cols-2',
      )}
    >
      <legend className="mb-3 type-card-title">{titulo}</legend>
      {descricao && (
        <p className="-mt-2 type-caption text-muted-foreground sm:col-span-full">{descricao}</p>
      )}
      {children}
    </fieldset>
  )
}

export function CadastroSheet({
  open,
  onClose,
  titulo,
  descricao,
  status,
  formId,
  salvando,
  sujo,
  permissao,
  dados,
  historico,
  acoes,
  onAcao,
  textosAcao,
  somenteLeitura,
}: {
  open: boolean
  onClose: () => void
  titulo: string
  descricao: string
  /** Selo de status (registro existente). */
  status?: ReactNode
  /** id do <form> (o botão Salvar envia). */
  formId: string
  salvando: boolean
  /** Há alterações não salvas? */
  sujo: boolean
  /** Permissão de editar (ex.: 'motoristas.editar'). */
  permissao: string
  dados: ReactNode
  /** Tabela de histórico (registro existente). */
  historico?: ReactNode
  /** Ações de status permitidas agora. */
  acoes?: AcaoCadastro[]
  onAcao?: (acao: AcaoCadastro) => Promise<unknown>
  /** Textos da confirmação de cada ação. */
  textosAcao?: (acao: AcaoCadastro) => { titulo: string; corpo: string; botao: string }
  /** Registro que não se edita (ex.: perfil Administrador): sem Salvar, só Fechar. */
  somenteLeitura?: boolean
}) {
  const { t } = useTranslation()
  const [descartar, setDescartar] = useState(false)
  const [confirmar, setConfirmar] = useState<AcaoCadastro | null>(null)
  const fechar = () => (sujo ? setDescartar(true) : onClose())
  const textos = confirmar && textosAcao ? textosAcao(confirmar) : null
  // Ctrl+S (⌘S) salva, como nas outras telas de formulário.
  useHotkey(
    { key: 's', mod: true },
    () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit(),
    open && !salvando && !somenteLeitura,
  )

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && fechar()}>
        <SheetContent className="w-full gap-0 sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle className="flex flex-wrap items-center gap-2">
              {titulo}
              {status}
            </SheetTitle>
            <SheetDescription>{descricao}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {!somenteLeitura && (
              <p className="mb-4 type-caption text-muted-foreground">
                <span aria-hidden className="text-danger-subtle-foreground">
                  *
                </span>{' '}
                {t('patterns.form.requiredHint')}
              </p>
            )}
            {historico ? (
              <Tabs defaultValue="dados">
                <TabsList>
                  <TabsTrigger value="dados">
                    <ClipboardList aria-hidden />
                    {t('cadastro.abas.dados')}
                  </TabsTrigger>
                  <TabsTrigger value="historico">
                    <History aria-hidden />
                    {t('cadastro.abas.historico')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="dados" className="pt-4">
                  {dados}
                </TabsContent>
                <TabsContent value="historico" className="pt-4">
                  {historico}
                </TabsContent>
              </Tabs>
            ) : (
              dados
            )}
          </div>
          <SheetFooter className="flex-row flex-wrap justify-between gap-2 border-t">
            <div className="flex gap-2">
              {acoes?.map((acao) => (
                <Can key={acao} permission={permissao} fallback="disable">
                  <Button
                    variant={acao === 'inativar' ? 'secondary' : 'default'}
                    onClick={() => setConfirmar(acao)}
                  >
                    {acao === 'inativar' ? (
                      <CircleMinus aria-hidden />
                    ) : (
                      <CircleCheck aria-hidden />
                    )}
                    {textosAcao?.(acao).botao}
                  </Button>
                </Can>
              ))}
            </div>
            {somenteLeitura ? (
              <Button variant="secondary" onClick={onClose}>
                {t('common.close')}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1 type-caption text-muted-foreground md:flex">
                  <Kbd>{isMac() ? '⌘' : 'Ctrl'}</Kbd>
                  <Kbd>S</Kbd>
                </span>
                <Button variant="secondary" onClick={fechar}>
                  {t('common.cancel')}
                </Button>
                <Can permission={permissao} fallback="disable">
                  <Button
                    type="submit"
                    form={formId}
                    loading={salvando}
                    aria-keyshortcuts={isMac() ? 'Meta+S' : 'Control+S'}
                  >
                    {!salvando && <Save aria-hidden />}
                    {t('common.save')}
                  </Button>
                </Can>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={descartar}
        onOpenChange={setDescartar}
        variant="destructive"
        title={t('patterns.unsaved.title')}
        description={t('patterns.unsaved.description')}
        confirmLabel={t('patterns.unsaved.leave')}
        onConfirm={onClose}
      />
      <ConfirmDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => !o && setConfirmar(null)}
        title={textos?.titulo ?? ''}
        description={textos?.corpo ?? ''}
        confirmLabel={textos?.botao ?? ''}
        onConfirm={async () => {
          if (confirmar) await onAcao?.(confirmar)
        }}
      />
    </>
  )
}
