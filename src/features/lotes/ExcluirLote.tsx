import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useExcluirLote } from '@/features/ordens/use-ordens'

/*
 * EXCLUIR LOTE (pedido do usuário, 27/10/2026 — o mesmo do iERP 1.0): só o lote agendado daqui.
 * Apaga de vez (documentos e viagens que esperavam o motorista); fica o registro na Auditoria.
 * O principal leva junto os lotes daqui juntados a ele; o juntado sai sozinho (a linha dele na
 * lista "Lotes juntados"). Confirmação forte: digitar o código.
 */
export function ExcluirLote({
  id,
  codigo,
  cliente,
  levaJuntos = [],
  ficam = [],
  permissao,
  compacto = false,
  onExcluido,
}: {
  id: string
  codigo: string
  cliente: string
  /** Códigos dos lotes daqui juntados a este (saem junto). */
  levaJuntos?: string[]
  /** Códigos dos lotes de outro sistema juntados a este (ficam). */
  ficam?: string[]
  permissao: string
  /** Botão pequeno (linha da lista dos juntados). */
  compacto?: boolean
  onExcluido?: () => void
}) {
  const { t } = useTranslation()
  const [aberto, setAberto] = useState(false)
  const excluir = useExcluirLote()
  return (
    <>
      <Can permission={permissao} fallback="disable">
        <Button
          variant="secondary"
          size={compacto ? 'sm' : 'default'}
          onClick={() => setAberto(true)}
        >
          <Trash2 aria-hidden />
          {t('lotes.excluir.botao')}
          {compacto && <span className="sr-only"> {codigo}</span>}
        </Button>
      </Can>
      <ConfirmDialog
        open={aberto}
        onOpenChange={setAberto}
        variant="destructive"
        title={t('lotes.excluir.titulo', { code: codigo })}
        description={
          <span className="flex flex-col gap-2">
            <span>{t('lotes.excluir.descricao', { code: codigo, cliente })}</span>
            {levaJuntos.length > 0 && (
              <span>{t('lotes.excluir.levaJuntos', { codes: levaJuntos.join(', ') })}</span>
            )}
            {ficam.length > 0 && (
              <span>{t('lotes.excluir.ficam', { codes: ficam.join(', ') })}</span>
            )}
          </span>
        }
        confirmText={codigo}
        confirmLabel={t('lotes.excluir.confirmar')}
        onConfirm={async () => {
          // A recusa (recebido, caminhão na rua) já aparece no aviso de erro.
          const r = await excluir.mutateAsync(id).catch(() => null)
          if (r) onExcluido?.()
        }}
      />
    </>
  )
}
