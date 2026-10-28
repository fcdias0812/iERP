import { useTranslation } from 'react-i18next'
import { ChevronDown, FileArchive, FileDown, FileText, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'
import { useCliente } from '@/features/clientes/use-clientes'
import { urlPdfOrdem, urlRelatorioFinal } from '@/services/ordens'
import type { Ordem } from '@/services/types'
import { useNomeDoTipo } from './tipos-documento'
import { etiquetasDosPallets, useImprimirEtiquetas } from './etiquetas-pallet'

/*
 * PDF da OS e ZIP do relatório final (pedido do usuário, 22/10/2026). O PDF sai a qualquer
 * momento; o ZIP (PDF + planilha de recebimento/processamento + os documentos marcados "vai no
 * relatório final" nas Configurações do cliente) só com o lote recebido e um documento de cada
 * tipo marcado — senão o item diz o que falta. O servidor confere de novo ao gerar.
 */
export function DocumentosGerados({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const nomeDoTipo = useNomeDoTipo()
  const cliente = useCliente(o.clienteId).data
  const recebido = o.status !== 'agendado' && o.status !== 'cancelado'
  const tipos = new Set(o.anexos.map((a) => a.tipo))
  const faltam = [
    ...(recebido ? [] : [t('lotes.gerar.faltaRecebimento')]),
    ...(cliente?.configuracoes.documentos ?? [])
      .filter((d) => d.relatorio && !tipos.has(d.codigo))
      .map((d) => nomeDoTipo(d.codigo, d.nome)),
  ]
  const falta = faltam.length ? t('lotes.gerar.falta', { itens: faltam.join(', ') }) : null
  const imprimir = useImprimirEtiquetas()
  const pallets = recebido ? [...o.pallets].sort((a, b) => a.numero - b.numero) : []
  const reimprimir = async () => {
    const ok = await imprimir(
      etiquetasDosPallets({
        cliente: o.clienteNome,
        lote: o.codigo,
        data: o.recebimento?.dataRecebimento ?? pallets[0]?.pesadoEm ?? o.alteradoEm,
        pallets: pallets.map((p) => ({ bruto: p.pesoKg, tara: p.taraKg })),
      }),
      o.id,
    )
    if (!ok)
      toast.error(t('recebimento.etiquetas.bloqueadoTitulo'), {
        description: t('recebimento.etiquetas.bloqueado'),
      })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <FileDown aria-hidden />
          {t('lotes.gerar.botao')}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-80">
        <DropdownMenuItem asChild>
          <a href={urlPdfOrdem(o.id)} download>
            <FileText aria-hidden />
            {t('lotes.gerar.pdf')}
          </a>
        </DropdownMenuItem>
        {/* Etiqueta perdida ou rasgada: imprime de novo com os pesos gravados (27/10/2026). */}
        {pallets.length > 0 && (
          <DropdownMenuItem onSelect={() => void reimprimir()}>
            <Printer aria-hidden />
            {t('lotes.gerar.etiquetas', { n: pallets.length })}
          </DropdownMenuItem>
        )}
        {falta ? (
          <DropdownMenuItem
            onSelect={() => toast.warning(t('lotes.gerar.naoPronto'), { description: falta })}
          >
            <FileArchive aria-hidden />
            <span className="flex flex-col">
              {t('lotes.gerar.relatorio')}
              <span className="type-caption text-muted-foreground">{falta}</span>
            </span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <a href={urlRelatorioFinal(o.id)} download>
              <FileArchive aria-hidden />
              {t('lotes.gerar.relatorio')}
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
