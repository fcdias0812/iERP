import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/sonner'
import { detectarIdioma, type LocalizedText } from '@/lib/localized-text'
import {
  completarTraducoes,
  criarTextoTraduzido,
  type MotivoFalha,
  type ResultadoTraducao,
} from '@/services/traducao'
import { useUiStore, type Language } from '@/stores/ui-store'

/**
 * Idioma em que o texto foi ESCRITO: detectado automaticamente enquanto a pessoa digita,
 * com opção de corrigir (`definir`). O idioma da tela é só o palpite para textos ambíguos.
 */
export function useIdiomaTexto(texto: string, inicial?: Language) {
  const idiomaTela = useUiStore((s) => s.language)
  const [escolhido, setEscolhido] = useState<Language | null>(inicial ?? null)
  const deteccao = detectarIdioma(texto, idiomaTela)
  return {
    idioma: escolhido ?? deteccao.idioma,
    /** `true` = veio da detecção (não foi escolhido pela pessoa). */
    detectado: escolhido === null,
    confiavel: escolhido !== null || deteccao.confiavel,
    definir: setEscolhido,
    limpar: () => setEscolhido(null),
  }
}

/**
 * Traduz ao salvar, avisando (toast) quando o texto precisa ser salvo sem tradução.
 * Nunca impede o salvamento: o original sempre é guardado.
 */
export function useTraducao() {
  const { t } = useTranslation()
  const idiomaTela = useUiStore((s) => s.language)
  const [traduzindo, setTraduzindo] = useState(false)

  const avisar = (r: ResultadoTraducao) => {
    if (!r.falhas.length) return
    toast.warning(t('traducao.falhou'), {
      description: t(
        `traducao.motivo.${r.motivo ?? 'servico'}` as `traducao.motivo.${MotivoFalha}`,
      ),
    })
  }

  const rodar = async (fn: () => Promise<ResultadoTraducao>) => {
    setTraduzindo(true)
    try {
      const r = await fn()
      avisar(r)
      return r.valor
    } finally {
      setTraduzindo(false)
    }
  }

  return {
    traduzindo,
    /** Texto digitado → LocalizedText com os 3 idiomas (ou pendentes). */
    traduzir: (texto: string, origem?: Language) =>
      rodar(() => criarTextoTraduzido(texto, idiomaTela, origem)),
    /** Tenta de novo os idiomas pendentes. */
    completar: (v: LocalizedText) => rodar(() => completarTraducoes(v)),
  }
}
