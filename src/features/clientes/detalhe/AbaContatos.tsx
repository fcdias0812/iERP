import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { ContatosTabela } from '@/features/comum/ContatosTabela'
import type { Cliente } from '@/services/types'

/** Contatos do cliente: o principal sempre em primeiro e destacado. */
export function AbaContatos({ c, onEditar }: { c: Cliente; onEditar: () => void }) {
  const { t } = useTranslation()
  return (
    <ContatosTabela
      id="cliente-contatos"
      titulo={t('clientes.tabs.contatos')}
      contatos={c.contatos}
      exportName={`contatos-${c.codigo}`}
      toolbar={
        <Can permission="clientes.editar" fallback="hide">
          <Button size="sm" variant="secondary" onClick={onEditar}>
            <Pencil aria-hidden />
            {t('clientes.detail.manageContacts')}
          </Button>
        </Can>
      }
    />
  )
}
