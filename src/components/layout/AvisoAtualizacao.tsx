import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { buildPublicado, haVersaoNova, INTERVALO_ATUALIZACAO_MS } from '@/lib/atualizacao'
import { reiniciarNaVersaoNova, useAtualizacaoStore } from '@/stores/atualizacao-store'

/*
 * O aviso de VERSÃO NOVA (pedido do usuário, 28/10/2026): a página pergunta ao servidor a cada
 * 5 minutos (e ao voltar para a aba) qual é o build publicado. Mudou: o pop-up oferece reiniciar
 * agora ou continuar o que está fazendo (para não perder nada). Quem continua vê o "?" no botão
 * Novidades, com o mesmo convite para reiniciar lá dentro (NovidadesButton). Também aparece
 * quando uma tela não carrega porque o site já foi trocado (`vite:preloadError`).
 * No `npm run dev` não pergunta (o próprio Vite recarrega o que muda).
 */
export function AvisoAtualizacao() {
  const { t } = useTranslation()
  const nova = useAtualizacaoStore((s) => s.nova)
  const adiada = useAtualizacaoStore((s) => s.adiada)
  const encontrar = useAtualizacaoStore((s) => s.encontrar)
  const adiar = useAtualizacaoStore((s) => s.adiar)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const controle = new AbortController()
    const conferir = async () => {
      const publicado = await buildPublicado(controle.signal)
      if (publicado && haVersaoNova(publicado)) encontrar(publicado)
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void conferir()
    }
    // Uma tela que não carrega depois da troca do site também é versão nova.
    const telaSemCarregar = (e: Event) => {
      e.preventDefault()
      encontrar('nao-carregou')
    }
    void conferir()
    const relogio = setInterval(() => void conferir(), INTERVALO_ATUALIZACAO_MS)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('vite:preloadError', telaSemCarregar)
    return () => {
      controle.abort()
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('vite:preloadError', telaSemCarregar)
    }
  }, [encontrar])

  return (
    <ConfirmDialog
      open={Boolean(nova) && adiada !== nova}
      onOpenChange={(aberto) => !aberto && adiar()}
      title={t('atualizacao.titulo')}
      description={t('atualizacao.descricao')}
      cancelLabel={t('atualizacao.continuar')}
      confirmLabel={t('atualizacao.reiniciar')}
      onConfirm={reiniciarNaVersaoNova}
    />
  )
}
