import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Rótulos do histórico de um cadastro: ações comuns + os campos de cada um. */
export function useRotulosCadastro(campos: readonly string[], prefixo: string) {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      acoes: {
        criado: t('historico.acoes.criado'),
        editado: t('historico.acoes.editado'),
        status: t('historico.acoes.status'),
      },
      campos: {
        ...Object.fromEntries(
          campos.map((c) => [c, t(`${prefixo}.${c}` as 'cadastros.cols.status')]),
        ),
        status: t('cadastros.cols.status'),
      },
    }),
    [t, campos, prefixo],
  )
}
