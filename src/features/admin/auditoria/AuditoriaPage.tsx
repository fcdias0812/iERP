import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRotulosPerfil } from '@/features/admin/perfis/rotulos'
import { HistoricoTabela, type RegistroDaLinha } from '@/features/comum/HistoricoTabela'
import { desdeDo, type Periodo } from '@/features/historico/periodo'
import { SeletorPeriodo } from '@/features/historico/SeletorPeriodo'
import { ACOES_LOTE, useRotulosHistoricoLote } from '@/features/lotes/historico-lote'
import { usePerfis } from '@/hooks/use-can'
import { apiErrorMessage } from '@/lib/api-errors'
import { textoEm } from '@/lib/localized-text'
import { listarAuditoria, perfisKeys } from '@/services/perfis'
import type {
  EventoAuditoria,
  EventoHistorico,
  Mudanca,
  TipoDocumento,
  TipoRegistroAuditoria,
} from '@/services/types'
import { useUiStore } from '@/stores/ui-store'

/*
 * Administração › Auditoria (pedido do usuário, 19/10/2026): o histórico completo de tudo o que
 * acontece no sistema — clientes, transportadoras, motoristas, veículos, lotes, cadastros,
 * usuários e perfis — numa só tabela de auditoria, com o tipo e o registro (link para ele).
 * Período carregado como nos históricos de módulo (padrão 90 dias).
 */

const TIPOS: TipoRegistroAuditoria[] = [
  'cliente',
  'transportadora',
  'motorista',
  'veiculo',
  'ordem',
  'material',
  'recipiente',
  'area',
  'usuario',
  'perfil',
]

/** Onde estão os rótulos dos campos de cada tipo (o lote e o perfil têm os seus). */
const PREFIXO_CAMPOS: Partial<Record<TipoRegistroAuditoria, string>> = {
  cliente: 'clientes.historico.campos',
  transportadora: 'transportadoras.campos',
  motorista: 'motoristas.campos',
  veiculo: 'veiculos.cols',
  material: 'cadastros.materiais.cols',
  area: 'cadastros.areas.cols',
  recipiente: 'cadastros.recipientes.cols',
  usuario: 'usuarios.cols',
}

/** Ações próprias de cada tipo (as comuns — criado, editado, status — valem para todos). */
const ACOES_CLIENTE = [
  'site_criado',
  'site_editado',
  'site_removido',
  'documento_adicionado',
  'documento_removido',
]

const SEM_EVENTOS: EventoAuditoria[] = []
const LINK = 'text-link underline-offset-4 hover:underline'

export function AuditoriaPage() {
  return (
    <RequirePermission permission="admin.auditoria.ver">
      <Auditoria />
    </RequirePermission>
  )
}

function Auditoria() {
  const { t, i18n } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const [periodo, setPeriodo] = useState<Periodo>('90')
  // O início do período é fixado ao escolher (não muda a cada render).
  const desde = useMemo(() => desdeDo(periodo), [periodo])
  const consulta = useQuery({
    queryKey: perfisKeys.auditoria(desde),
    queryFn: ({ signal }) => listarAuditoria(desde, signal),
  })
  const eventos = consulta.data ?? SEM_EVENTOS
  const lote = useRotulosHistoricoLote()
  const perfil = useRotulosPerfil()
  const camposLote = lote.campos
  const camposPerfil = perfil.campos
  const perfis = usePerfis()
  const listaPerfis = perfis.data

  const acoes = useMemo(
    () => ({
      ...Object.fromEntries(ACOES_LOTE.map((a) => [a, t(`lotes.historico.acoes.${a}`)])),
      ...Object.fromEntries(
        ACOES_CLIENTE.map((a) => [a, t(`clientes.history.${a as 'site_criado'}`)]),
      ),
      criado: t('historico.acoes.criado'),
      editado: t('historico.acoes.editado'),
      status: t('historico.acoes.status'),
    }),
    [t],
  )

  // Rótulos dos campos que aparecem nos eventos carregados (cada tipo tem os seus).
  const campos = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const e of eventos)
      for (const m of e.mudancas ?? []) {
        if (m.campo in mapa) continue
        const prefixo = PREFIXO_CAMPOS[e.tipo]
        const chave = `${prefixo}.${m.campo}`
        mapa[m.campo] =
          e.tipo === 'ordem'
            ? (camposLote[m.campo as keyof typeof camposLote] ?? m.campo)
            : e.tipo === 'perfil'
              ? (camposPerfil[m.campo as keyof typeof camposPerfil] ?? m.campo)
              : prefixo && i18n.exists(chave)
                ? t(chave as 'perfis.cols.nome')
                : m.campo === 'status'
                  ? t('cadastros.cols.status')
                  : m.campo
      }
    return mapa
  }, [eventos, camposLote, camposPerfil, i18n, t])

  const formatar = useCallback(
    (campo: string, v: Mudanca['antes'], e: EventoHistorico | EventoAuditoria) => {
      const tipo = 'tipo' in e ? e.tipo : null
      if (tipo === 'ordem') return lote.formatar(campo, v)
      if (tipo === 'perfil') return perfil.formatar(campo, v)
      if (tipo === 'cliente' && campo === 'tipoDocumento')
        return t(`clientes.documentos.tipos.${v as TipoDocumento}`)
      if (tipo === 'cliente' && campo === 'regiao')
        return t(`clientes.sites.regioes.${v as 'sul'}`, { defaultValue: String(v) })
      if (tipo === 'cliente' && campo === 'cep')
        return String(v).replace(/^(\d{5})(\d{3})$/, '$1-$2')
      if (tipo === 'veiculo' && campo === 'tipo')
        return t(`veiculos.tipos.${v as 'van'}`, { defaultValue: String(v) })
      if (tipo === 'usuario' && campo === 'perfil') {
        const p = listaPerfis?.find((x) => x.id === v)
        return p ? textoEm(p.nome, idioma) : String(v)
      }
      return undefined
    },
    [lote, perfil, t, listaPerfis, idioma],
  )

  const registro = useMemo(
    () => ({
      titulo: t('auditoria.cols.registro'),
      tipos: Object.fromEntries(TIPOS.map((tp) => [tp, t(`auditoria.tipos.${tp}`)])),
      link: (r: RegistroDaLinha) => <LinkRegistro r={r} />,
    }),
    [t],
  )

  return (
    <ListPage title={t('nav.admin.auditoria')} description={t('auditoria.descricao')}>
      <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
      {consulta.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : consulta.isError ? (
        <Alert
          tone="danger"
          title={t('auditoria.erro')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void consulta.refetch()}>
              {t('common.tryAgain')}
            </Button>
          }
        >
          {apiErrorMessage(consulta.error)}
        </Alert>
      ) : (
        <HistoricoTabela
          id="auditoria"
          titulo={t('nav.admin.auditoria')}
          historico={eventos}
          exportName="auditoria"
          acoes={acoes}
          campos={campos}
          formatar={formatar}
          registro={registro}
        />
      )}
    </ListPage>
  )
}

/** Link para o registro, onde ele mora (detalhe ou painel da lista). */
function LinkRegistro({ r }: { r: RegistroDaLinha }) {
  const { id, rotulo } = r
  switch (r.tipo as TipoRegistroAuditoria) {
    case 'cliente':
      return (
        <Link to="/clientes/$id" params={{ id }} search={{ aba: 'historico' }} className={LINK}>
          {rotulo}
        </Link>
      )
    case 'transportadora':
      return (
        <Link to="/transportadoras/$id" params={{ id }} className={LINK}>
          {rotulo}
        </Link>
      )
    case 'motorista':
      return (
        <Link to="/motoristas" search={{ aberto: id }} className={LINK}>
          {rotulo}
        </Link>
      )
    case 'veiculo':
      return (
        <Link to="/veiculos" search={{ aberto: id }} className={`font-mono ${LINK}`}>
          {rotulo}
        </Link>
      )
    case 'ordem':
      return (
        <Link
          to="/ordens/lotes/$id"
          params={{ id }}
          search={{ aba: 'historico' }}
          className={`font-mono ${LINK}`}
        >
          {rotulo}
        </Link>
      )
    case 'material':
      return (
        <Link to="/cadastros/materiais" search={{ aberto: id }} className={LINK}>
          {rotulo}
        </Link>
      )
    case 'area':
      return (
        <Link to="/cadastros/areas" search={{ aberto: id }} className={LINK}>
          {rotulo}
        </Link>
      )
    case 'recipiente':
      return (
        <Link
          to={r.subtipo === 'pallet' ? '/cadastros/pallets' : '/cadastros/caixotes'}
          search={{ aberto: id }}
          className={`font-mono ${LINK}`}
        >
          {rotulo}
        </Link>
      )
    case 'usuario':
      return (
        <Link to="/admin/usuarios/$id" params={{ id }} className={LINK}>
          {rotulo}
        </Link>
      )
    case 'perfil':
      return (
        <Link to="/admin/perfis" search={{ aberto: id }} className={LINK}>
          {rotulo}
        </Link>
      )
    default:
      return <span>{rotulo}</span>
  }
}
