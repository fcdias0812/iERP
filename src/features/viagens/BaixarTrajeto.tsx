import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { FORMATOS_TRAJETO, urlExportarViagem } from '@/services/viagens'
import type { Viagem } from '@/services/types'
import { temTrajeto } from './formato'

/*
 * Os TRÊS ARQUIVOS do trajeto de uma viagem terminada — GPX (apps de GPS), KML (Google Earth) e
 * CSV (planilha) —, como no iERP antigo (pedido do usuário, 20/10/2026). Um componente só para
 * os dois lugares (botões no replay, itens no menu ⋯ da tabela): a lista de formatos casa com o
 * servidor (`server/src/modules/viagens/exportar.ts`).
 */

export function BaixarTrajeto({
  viagem,
  comoMenu = false,
}: {
  viagem: Viagem
  comoMenu?: boolean
}) {
  const { t } = useTranslation()
  if (!temTrajeto(viagem)) return null
  return (
    <>
      {FORMATOS_TRAJETO.map((formato) => {
        const rotulo = t('viagens.baixar.botao', { formato: formato.toUpperCase() })
        // `download`: o navegador SALVA em vez de abrir o XML do GPX numa aba.
        const link = (
          <a href={urlExportarViagem(viagem.id, formato)} download>
            <Download aria-hidden />
            {rotulo}
          </a>
        )
        return comoMenu ? (
          <DropdownMenuItem key={formato} asChild>
            {link}
          </DropdownMenuItem>
        ) : (
          <Button key={formato} size="sm" variant="secondary" asChild>
            {link}
          </Button>
        )
      })}
    </>
  )
}
