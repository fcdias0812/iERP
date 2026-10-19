import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { TextoTraduzido } from '@/components/ui/localized-text'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { PAGINAS } from '@/config/paginas'
import type { NivelAcesso } from '@/config/permissions'
import { RodapeTraduzivel } from '@/features/cadastros/CampoTraduzivel'
import { PainelCarregando } from '@/features/cadastros/comum'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan, usePerfis } from '@/hooks/use-can'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { formatNumber } from '@/lib/format'
import { textoEm, textoOriginal, type LocalizedText } from '@/lib/localized-text'
import { z } from '@/lib/zod-i18n'
import { ApiError } from '@/services/http'
import type { PerfilAcesso, PerfilAcessoDetalhe } from '@/services/types'
import { useUiStore } from '@/stores/ui-store'
import { MatrizPermissoes, type Matriz } from './MatrizPermissoes'
import { useRotulosPerfil } from './rotulos'
import { usePerfil, useSalvarPerfil, useTransicaoPerfil } from './use-perfis'

/*
 * Administração › Perfis de acesso (pedido do usuário, 19/10/2026): cada perfil diz, página por
 * página do menu, se a pessoa não tem acesso, só visualiza (ver e exportar) ou edita (tudo).
 * Cada usuário tem um perfil (escolhido em Administração › Usuários). O Administrador é fixo:
 * pode tudo e não se edita. Cadastro e edição no painel lateral (`?aberto=novo|<id>`).
 */

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }
const VAZIO: PerfilAcesso[] = []
const STATUS = ['ativo', 'inativo']
const MAX_NOME = 60
const MAX_DESCRICAO = 500

/** Quantas páginas o perfil acessa (o Administrador, todas). */
const paginasComAcesso = (p: PerfilAcesso) =>
  p.fixo ? PAGINAS.length : PAGINAS.filter((k) => p.permissoes[k]).length

export function PerfisPage() {
  return (
    <RequirePermission permission="admin.perfis.ver">
      <Perfis />
    </RequirePermission>
  )
}

function Perfis() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aberto } = useSearch({ strict: false }) as { aberto?: string }
  const abrir = (id: string | undefined) =>
    void navigate({ to: '.', search: (s: Record<string, unknown>) => ({ ...s, aberto: id }) })
  const idioma = useUiStore((s) => s.language)
  const lista = usePerfis()
  const podeCriar = useCan('admin.perfis.criar')
  const [query, setQuery] = useState<TableQuery>(ORDEM)

  const colunas = useMemo<DataTableColumn<PerfilAcesso>[]>(
    () => [
      {
        id: 'nome',
        header: t('perfis.cols.nome'),
        type: 'unique-text',
        accessor: (r) => textoEm(r.nome, idioma),
        size: 240,
        mobile: 'title',
        cell: (r) => (
          <span className="flex flex-wrap items-center gap-2">
            <TextoTraduzido valor={r.nome} compacto className="font-medium" />
            {r.fixo && <Badge variant="info">{t('perfis.fixo')}</Badge>}
          </span>
        ),
      },
      {
        id: 'descricao',
        header: t('perfis.cols.descricao'),
        type: 'unique-text',
        accessor: (r) => (r.descricao ? textoEm(r.descricao, idioma) : null),
        size: 320,
        cell: (r) =>
          r.descricao ? (
            <TextoTraduzido valor={r.descricao} compacto className="text-muted-foreground" />
          ) : (
            '—'
          ),
      },
      {
        id: 'paginas',
        header: t('perfis.cols.paginas'),
        type: 'number',
        accessor: paginasComAcesso,
        size: 160,
        cell: (r) => (
          <span className="num">
            {t('perfis.paginasDe', {
              n: formatNumber(paginasComAcesso(r)),
              total: formatNumber(PAGINAS.length),
            })}
          </span>
        ),
      },
      {
        id: 'usuarios',
        header: t('perfis.cols.usuarios'),
        type: 'number',
        accessor: (r) => r.usuarios,
        size: 120,
        cell: (r) => <span className="num">{formatNumber(r.usuarios)}</span>,
      },
      {
        id: 'status',
        header: t('perfis.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 130,
        mobile: 'badge',
        options: STATUS.map((s) => ({ value: s, label: s })),
      },
    ],
    [t, idioma],
  )

  return (
    <ListPage title={t('nav.admin.perfis')} description={t('perfis.descricaoPagina')}>
      <DataTable
        id="admin-perfis"
        title={t('nav.admin.perfis')}
        exportName="perfis-de-acesso"
        columns={colunas}
        getRowId={(r) => r.id}
        data={lista.data ?? VAZIO}
        query={query}
        onQueryChange={setQuery}
        loading={lista.isPending}
        error={lista.isError}
        onRetry={() => void lista.refetch()}
        onRowClick={(r) => abrir(r.id)}
        onCreate={podeCriar ? () => abrir('novo') : undefined}
        createLabel={t('perfis.novo')}
        empty={{ title: t('perfis.vazio') }}
      />
      {aberto && (
        <PerfilPainel
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => abrir(undefined)}
        />
      )}
    </ListPage>
  )
}

function PerfilPainel({ id, onClose }: { id?: string; onClose: () => void }) {
  const detalhe = usePerfil(id)
  if (id && detalhe.isPending) return <PainelCarregando />
  return (
    <PerfilFormulario
      perfil={detalhe.data}
      erro={Boolean(id) && detalhe.isError}
      onClose={onClose}
    />
  )
}

const schema = z.object({
  nome: z.string().trim().min(1, 'validation.required').max(MAX_NOME),
  descricao: z.string().trim().max(MAX_DESCRICAO),
})
type Form = z.input<typeof schema>

/** Matriz completa (toda página com um nível) a partir do perfil. */
function matrizDo(perfil?: PerfilAcessoDetalhe): Matriz {
  return Object.fromEntries(
    PAGINAS.map((k) => [k, perfil?.fixo ? 'editar' : (perfil?.permissoes[k] ?? 'nenhum')]),
  )
}

function PerfilFormulario({
  perfil,
  erro,
  onClose,
}: {
  perfil?: PerfilAcessoDetalhe
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = useSalvarPerfil(perfil?.id)
  const transicao = useTransicaoPerfil()
  const traducao = useTraducao()
  const rotulos = useRotulosPerfil()
  const fixo = Boolean(perfil?.fixo)
  const [inicial] = useState(() => matrizDo(perfil))
  const [matriz, setMatriz] = useState<Matriz>(inicial)
  const [nomeTraduzido, setNomeTraduzido] = useState<LocalizedText | null>(perfil?.nome ?? null)
  const [descTraduzida, setDescTraduzida] = useState<LocalizedText | null>(
    perfil?.descricao ?? null,
  )
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      nome: perfil ? textoOriginal(perfil.nome) : '',
      descricao: perfil?.descricao ? textoOriginal(perfil.descricao) : '',
    },
  })
  const nome = useWatch({ control: form.control, name: 'nome' }) ?? ''
  const descricao = useWatch({ control: form.control, name: 'descricao' }) ?? ''
  const idiomaNome = useIdiomaTexto(nome, perfil?.nome.origem)
  const idiomaDesc = useIdiomaTexto(descricao, perfil?.descricao?.origem)
  const matrizMudou = PAGINAS.some((k) => matriz[k] !== inicial[k])
  const total = PAGINAS.filter((k) => matriz[k] !== 'nenhum').length
  const editam = PAGINAS.filter((k) => matriz[k] === 'editar').length

  /** Reaproveita as traduções guardadas se o texto e o idioma não mudaram. */
  const traduzido = async (
    texto: string,
    guardado: LocalizedText | null,
    idioma: ReturnType<typeof useIdiomaTexto>['idioma'],
  ) =>
    guardado && textoOriginal(guardado).trim() === texto && idioma === guardado.origem
      ? guardado
      : traducao.traduzir(texto, idioma)

  const enviar = form.handleSubmit(async (v) => {
    const nomeFinal = await traduzido(v.nome.trim(), nomeTraduzido, idiomaNome.idioma)
    const desc = v.descricao.trim()
      ? await traduzido(v.descricao.trim(), descTraduzida, idiomaDesc.idioma)
      : null
    const permissoes = Object.fromEntries(
      PAGINAS.map((k) => [k, matriz[k] === 'nenhum' ? null : (matriz[k] as NivelAcesso)]),
    )
    const salvo = await salvar
      .mutateAsync({ nome: nomeFinal, descricao: desc, permissoes })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === 'name_in_use')
          form.setError('nome', { message: 'validation.nameInUse' })
        return null
      })
    if (salvo) {
      form.reset(v)
      onClose()
    }
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={perfil ? textoOriginal(perfil.nome) : t('perfis.novo')}
      descricao={t('perfis.descricaoPainel')}
      status={perfil ? <StatusBadge status={perfil.status} /> : undefined}
      formId="form-perfil"
      salvando={form.formState.isSubmitting}
      sujo={
        form.formState.isDirty ||
        matrizMudou ||
        nomeTraduzido !== (perfil?.nome ?? null) ||
        descTraduzida !== (perfil?.descricao ?? null)
      }
      permissao={perfil ? 'admin.perfis.editar' : 'admin.perfis.criar'}
      somenteLeitura={fixo}
      acoes={perfil?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: perfil!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`cadastros.confirm.${acao}.title`, { name: textoOriginal(perfil!.nome) }),
        corpo: t(`perfis.confirm.${acao}`),
        botao: t(`cadastros.acoes.${acao}`),
      })}
      historico={
        perfil ? (
          <HistoricoTabela
            id="perfil-historico"
            titulo={t('cadastro.abas.historico')}
            historico={perfil.historico}
            exportName="historico-perfil"
            acoes={rotulos.acoes}
            campos={rotulos.campos}
            formatar={rotulos.formatar}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-perfil"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (!fixo) void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          {fixo && (
            <Alert tone="info" title={t('perfis.fixoTitle')}>
              {t('perfis.fixoBody')}
            </Alert>
          )}
          {perfil?.status === 'inativo' && (
            <Alert tone="inactive" title={t('cadastros.inativoTitle')}>
              {t('perfis.inativoBody')}
            </Alert>
          )}
          <CadastroSecao titulo={t('perfis.secaoDados')} colunas={1}>
            <div className="flex flex-col gap-1.5">
              <RhfField
                control={form.control}
                name="nome"
                label={t('perfis.cols.nome')}
                help={t('cadastros.ajudaTraducao')}
                maxLength={MAX_NOME}
                required
              >
                {({ field, control }) => (
                  <Input {...control} {...field} autoComplete="off" readOnly={fixo} />
                )}
              </RhfField>
              {!fixo && (
                <RodapeTraduzivel
                  rotulo={t('perfis.cols.nome')}
                  texto={nome}
                  idioma={idiomaNome.idioma}
                  detectado={idiomaNome.detectado}
                  onIdioma={idiomaNome.definir}
                  traduzido={nomeTraduzido}
                  maxLength={MAX_NOME}
                  onRevisar={(v) => {
                    setNomeTraduzido(v)
                    form.setValue('nome', textoOriginal(v), { shouldDirty: true })
                    idiomaNome.definir(v.origem)
                  }}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <RhfField
                control={form.control}
                name="descricao"
                label={t('perfis.cols.descricao')}
                help={t('perfis.descricaoAjuda')}
                maxLength={MAX_DESCRICAO}
              >
                {({ field, control }) => (
                  <Textarea {...control} {...field} rows={2} readOnly={fixo} />
                )}
              </RhfField>
              {!fixo && (
                <RodapeTraduzivel
                  rotulo={t('perfis.cols.descricao')}
                  texto={descricao}
                  idioma={idiomaDesc.idioma}
                  detectado={idiomaDesc.detectado}
                  onIdioma={idiomaDesc.definir}
                  traduzido={descTraduzida}
                  multilinha
                  maxLength={MAX_DESCRICAO}
                  onRevisar={(v) => {
                    setDescTraduzida(v)
                    form.setValue('descricao', textoOriginal(v), { shouldDirty: true })
                    idiomaDesc.definir(v.origem)
                  }}
                />
              )}
            </div>
          </CadastroSecao>
          <CadastroSecao
            titulo={t('perfis.secaoPaginas')}
            descricao={t('perfis.secaoPaginasAjuda')}
            colunas={1}
          >
            <p className="type-caption text-muted-foreground" aria-live="polite">
              {t('perfis.resumo', {
                n: formatNumber(total),
                total: formatNumber(PAGINAS.length),
                editar: formatNumber(editam),
              })}
            </p>
            <MatrizPermissoes valor={matriz} onChange={setMatriz} somenteLeitura={fixo} />
          </CadastroSecao>
        </form>
      }
    />
  )
}
