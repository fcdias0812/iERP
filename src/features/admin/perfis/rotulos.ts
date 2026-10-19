import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GRUPOS_DE_PAGINAS } from '@/config/paginas'
import type { Mudanca } from '@/services/types'

/*
 * Rótulos do histórico do perfil de acesso (no painel do perfil e na Auditoria): cada página que
 * mudou de nível vira o campo `pagina:<página>` ("Ordens › Lotes"), com o nível traduzido.
 */

const PREFIXO = 'pagina:'

export function useRotulosPerfil() {
  const { t } = useTranslation()
  const campos = useMemo(
    () => ({
      nome: t('perfis.cols.nome'),
      descricao: t('perfis.cols.descricao'),
      status: t('perfis.cols.status'),
      ...Object.fromEntries(
        GRUPOS_DE_PAGINAS.flatMap((g) =>
          g.paginas.map((p) => [`${PREFIXO}${p.chave}`, `${t(g.labelKey)} › ${t(p.labelKey)}`]),
        ),
      ),
    }),
    [t],
  )
  const acoes = useMemo(
    () => ({
      criado: t('historico.acoes.criado'),
      editado: t('historico.acoes.editado'),
      status: t('historico.acoes.status'),
    }),
    [t],
  )
  const formatar = useCallback(
    (campo: string, v: Mudanca['antes']) =>
      campo.startsWith(PREFIXO) ? t(`perfis.niveis.${v as 'ver'}`) : undefined,
    [t],
  )
  return { acoes, campos, formatar }
}
