import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { KeyRound, RefreshCw, ShieldOff } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/components/data-table'
import { EMPTY_QUERY, type TableQuery } from '@/components/data-table/types'
import { Can } from '@/components/layout/Can'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { ListPage } from '@/components/patterns/ListPage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RhfField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CopyableId, KeyValueList } from '@/components/ui/metadata'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PainelCarregando } from '@/features/cadastros/comum'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import { useCan } from '@/hooks/use-can'
import { EMPTY, formatDateTime, formatNumber } from '@/lib/format'
import { z } from '@/lib/zod-i18n'
import type { AvisoIntegracao, Integracao, IntegracaoDetalhe } from '@/services/types'
import {
  useGerarChave,
  useIntegracao,
  useIntegracoes,
  useRevogarChave,
  useSalvarIntegracao,
  useSistemasIntegraveis,
  useTransicaoIntegracao,
} from './use-integracoes'

/*
 * Administração › Integração (pedido do usuário, 19/10/2026): os sistemas de fora que
 * conversam com o iERP — hoje o MoonShot, que processa os lotes da Dell. O contrato é o MESMO
 * do iERP antigo, e os dois iERPs funcionam juntos até o novo substituir o antigo:
 *  - a CHAVE com que o sistema entra aqui (aparece uma vez só, ao gerar);
 *  - o endereço dos AVISOS ("chegou o lote LOT-00001": ele busca o lote com a chave);
 *  - o PAINEL de andamento que o iERP lê a cada 30 s (fase "Processamento i/N").
 */

const ORDEM: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'nome', desc: false }] }
const ORDEM_AVISOS: TableQuery = { ...EMPTY_QUERY, sort: [{ id: 'criadoEm', desc: true }] }
const VAZIO: Integracao[] = []
const SEM_AVISOS: AvisoIntegracao[] = []
const STATUS = ['ativo', 'inativo']
const MIN_TOKEN = 32

export function IntegracaoPage() {
  return (
    <RequirePermission permission="admin.integracao.ver">
      <Integracoes />
    </RequirePermission>
  )
}

function Integracoes() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { aberto } = useSearch({ strict: false }) as { aberto?: string }
  const abrir = (id: string | undefined) =>
    void navigate({ to: '.', search: (s: Record<string, unknown>) => ({ ...s, aberto: id }) })
  const lista = useIntegracoes()
  const podeCriar = useCan('admin.integracao.criar')
  const [query, setQuery] = useState<TableQuery>(ORDEM)

  const colunas = useMemo<DataTableColumn<Integracao>[]>(
    () => [
      {
        id: 'nome',
        header: t('integracao.cols.nome'),
        type: 'unique-text',
        accessor: (r) => r.nome,
        size: 220,
        mobile: 'title',
        cell: (r) => <span className="font-medium">{r.nome}</span>,
      },
      {
        id: 'sistema',
        header: t('integracao.cols.sistema'),
        type: 'unique-text',
        accessor: (r) => r.sistema,
        size: 140,
        cell: (r) => <span className="font-mono">{r.sistema}</span>,
      },
      {
        id: 'chave',
        header: t('integracao.cols.chave'),
        type: 'unique-text',
        accessor: (r) => r.chavePrefixo,
        size: 150,
        cell: (r) =>
          r.chavePrefixo ? (
            <span className="font-mono">{`${r.chavePrefixo}…`}</span>
          ) : (
            <span className="text-muted-foreground">{t('integracao.semChave')}</span>
          ),
      },
      {
        id: 'ultimoUsoEm',
        header: t('integracao.cols.ultimoUsoEm'),
        type: 'date',
        accessor: (r) => r.ultimoUsoEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.ultimoUsoEm)}</span>,
      },
      {
        id: 'ultimoPainelEm',
        header: t('integracao.cols.ultimoPainelEm'),
        type: 'date',
        accessor: (r) => r.ultimoPainelEm,
        size: 170,
        cell: (r) => <span className="num">{formatDateTime(r.ultimoPainelEm)}</span>,
      },
      {
        id: 'avisosPendentes',
        header: t('integracao.cols.avisosPendentes'),
        type: 'number',
        accessor: (r) => r.avisosPendentes,
        size: 140,
        cell: (r) => <span className="num">{formatNumber(r.avisosPendentes)}</span>,
      },
      {
        id: 'status',
        header: t('integracao.cols.status'),
        type: 'status',
        accessor: (r) => r.status,
        size: 130,
        mobile: 'badge',
        options: STATUS.map((s) => ({ value: s, label: s })),
      },
    ],
    [t],
  )

  return (
    <ListPage title={t('nav.admin.integracao')} description={t('integracao.descricaoPagina')}>
      <DataTable
        id="admin-integracao"
        title={t('nav.admin.integracao')}
        exportName="integracoes"
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
        createLabel={t('integracao.novo')}
        empty={{ title: t('integracao.vazio') }}
      />
      {aberto && (
        <IntegracaoPainel
          key={aberto}
          id={aberto === 'novo' ? undefined : aberto}
          onClose={() => abrir(undefined)}
        />
      )}
    </ListPage>
  )
}

function IntegracaoPainel({ id, onClose }: { id?: string; onClose: () => void }) {
  const detalhe = useIntegracao(id)
  if (id && detalhe.isPending) return <PainelCarregando />
  return (
    <IntegracaoFormulario
      integracao={detalhe.data}
      erro={Boolean(id) && detalhe.isError}
      onClose={onClose}
    />
  )
}

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'validation.url')

const schema = z.object({
  sistema: z.string().min(1, 'validation.required'),
  nome: z.string().trim().min(1, 'validation.required').max(80),
  urlAvisos: url,
  urlPainel: url,
  tokenPainel: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || v.length >= MIN_TOKEN, 'validation.tokenCurto'),
})
type Form = z.input<typeof schema>

function IntegracaoFormulario({
  integracao,
  erro,
  onClose,
}: {
  integracao?: IntegracaoDetalhe
  erro: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const sistemas = useSistemasIntegraveis()
  const salvar = useSalvarIntegracao(integracao?.id)
  const transicao = useTransicaoIntegracao()
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      sistema: integracao?.sistema ?? '',
      nome: integracao?.nome ?? '',
      urlAvisos: integracao?.urlAvisos ?? '',
      urlPainel: integracao?.urlPainel ?? '',
      tokenPainel: '',
    },
  })

  const enviar = form.handleSubmit(async (v) => {
    const salvo = await salvar
      .mutateAsync({
        sistema: integracao ? undefined : v.sistema,
        nome: v.nome,
        urlAvisos: v.urlAvisos || null,
        urlPainel: v.urlPainel || null,
        // Vazio = mantém o token guardado (ele nunca volta para a tela).
        ...(v.tokenPainel ? { tokenPainel: v.tokenPainel } : {}),
      })
      .catch(() => null)
    if (!salvo) return
    form.reset({ ...v, tokenPainel: '' })
    if (!integracao) onClose()
  })

  const rotulos = useRotulosIntegracao()

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={integracao ? integracao.nome : t('integracao.novo')}
      descricao={t('integracao.descricaoPainel')}
      status={integracao ? <StatusBadge status={integracao.status} /> : undefined}
      formId="form-integracao"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={integracao ? 'admin.integracao.editar' : 'admin.integracao.criar'}
      acoes={integracao?.acoesPermitidas}
      onAcao={(acao) => transicao.mutateAsync({ id: integracao!.id, acao })}
      textosAcao={(acao) => ({
        titulo: t(`cadastros.confirm.${acao}.title`, { name: integracao!.nome }),
        corpo: t(`integracao.confirm.${acao}`),
        botao: t(`cadastros.acoes.${acao}`),
      })}
      historico={
        integracao ? (
          <HistoricoTabela
            id="integracao-historico"
            titulo={t('cadastro.abas.historico')}
            historico={integracao.historico}
            exportName="historico-integracao"
            acoes={rotulos.acoes}
            campos={rotulos.campos}
          />
        ) : undefined
      }
      dados={
        <form
          id="form-integracao"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          {erro && <Alert tone="danger" title={t('apiErrors.server')} />}
          {integracao?.ultimoErro && (
            <Alert
              tone="danger"
              title={t('integracao.ultimoErro', {
                quando: formatDateTime(integracao.ultimoErroEm),
              })}
            >
              {integracao.ultimoErro}
            </Alert>
          )}
          <CadastroSecao titulo={t('integracao.secoes.sistema')}>
            <RhfField
              control={form.control}
              name="sistema"
              label={t('integracao.cols.sistema')}
              help={t('integracao.ajuda.sistema')}
              required
            >
              {({ field, control }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    const nome = sistemas.data?.find((s) => s.sistema === v)?.nome
                    if (nome && !form.getValues('nome'))
                      form.setValue('nome', nome, { shouldDirty: true })
                  }}
                  disabled={Boolean(integracao)}
                >
                  <SelectTrigger {...control}>
                    <SelectValue placeholder={t('integracao.escolherSistema')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(sistemas.data ?? []).map((s) => (
                      <SelectItem key={s.sistema} value={s.sistema}>
                        {`${s.nome} · ${s.sistema}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name="nome"
              label={t('integracao.cols.nome')}
              maxLength={80}
              required
            >
              {({ field, control }) => <Input {...control} {...field} autoComplete="off" />}
            </RhfField>
          </CadastroSecao>

          <CadastroSecao
            titulo={t('integracao.secoes.avisos')}
            descricao={t('integracao.ajuda.avisos')}
            colunas={1}
          >
            <RhfField
              control={form.control}
              name="urlAvisos"
              label={t('integracao.campos.urlAvisos')}
              help={t('integracao.ajuda.urlAvisos')}
            >
              {({ field, control }) => (
                <Input
                  {...control}
                  {...field}
                  inputMode="url"
                  autoComplete="off"
                  className="font-mono"
                  placeholder="http://192.168.0.10:5063/api/ierp2/avisos"
                />
              )}
            </RhfField>
          </CadastroSecao>

          <CadastroSecao
            titulo={t('integracao.secoes.painel')}
            descricao={t('integracao.ajuda.painel')}
            colunas={1}
          >
            <RhfField
              control={form.control}
              name="urlPainel"
              label={t('integracao.campos.urlPainel')}
            >
              {({ field, control }) => (
                <Input
                  {...control}
                  {...field}
                  inputMode="url"
                  autoComplete="off"
                  className="font-mono"
                  placeholder="http://192.168.0.10:5063/api/ierp2/painel"
                />
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name="tokenPainel"
              label={t('integracao.campos.tokenPainel')}
              help={
                integracao?.temTokenPainel
                  ? t('integracao.ajuda.tokenGuardado')
                  : t('integracao.ajuda.token', { min: MIN_TOKEN })
              }
            >
              {({ field, control }) => (
                <Input
                  {...control}
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder={integracao?.temTokenPainel ? '••••••••' : undefined}
                />
              )}
            </RhfField>
          </CadastroSecao>

          {integracao && <SecaoChave integracao={integracao} />}
          {integracao && <SecaoSituacao integracao={integracao} />}
        </form>
      }
    />
  )
}

/** A chave de acesso: gerar/trocar (mostra uma vez) e revogar. */
function SecaoChave({ integracao }: { integracao: IntegracaoDetalhe }) {
  const { t } = useTranslation()
  const gerar = useGerarChave()
  const revogar = useRevogarChave()
  const [confirmar, setConfirmar] = useState<'gerar' | 'revogar' | null>(null)
  const [chaveNova, setChaveNova] = useState<string | null>(null)
  const temChave = Boolean(integracao.chavePrefixo)

  return (
    <CadastroSecao
      titulo={t('integracao.secoes.chave')}
      descricao={t('integracao.ajuda.chave')}
      colunas={1}
    >
      <KeyValueList
        columns={2}
        items={[
          {
            label: t('integracao.cols.chave'),
            value: temChave ? (
              <span className="font-mono">{`${integracao.chavePrefixo}…`}</span>
            ) : (
              t('integracao.semChave')
            ),
          },
          {
            label: t('integracao.campos.chaveCriadaEm'),
            value: integracao.chaveCriadaEm ? formatDateTime(integracao.chaveCriadaEm) : null,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Can permission="admin.integracao.editar" fallback="disable">
          <Button
            type="button"
            variant="secondary"
            onClick={() => (temChave ? setConfirmar('gerar') : void criar())}
            loading={gerar.isPending}
          >
            {!gerar.isPending && (temChave ? <RefreshCw aria-hidden /> : <KeyRound aria-hidden />)}
            {temChave ? t('integracao.trocarChave') : t('integracao.gerarChave')}
          </Button>
        </Can>
        {temChave && (
          <Can permission="admin.integracao.editar" fallback="disable">
            <Button type="button" variant="secondary" onClick={() => setConfirmar('revogar')}>
              <ShieldOff aria-hidden />
              {t('integracao.revogarChave')}
            </Button>
          </Can>
        )}
      </div>
      <ConfirmDialog
        open={confirmar !== null}
        onOpenChange={(o) => !o && setConfirmar(null)}
        variant="destructive"
        title={
          confirmar === 'revogar'
            ? t('integracao.confirmRevogar.title')
            : t('integracao.confirmTrocar.title')
        }
        description={
          confirmar === 'revogar'
            ? t('integracao.confirmRevogar.body', { name: integracao.nome })
            : t('integracao.confirmTrocar.body', { name: integracao.nome })
        }
        confirmLabel={
          confirmar === 'revogar' ? t('integracao.revogarChave') : t('integracao.trocarChave')
        }
        onConfirm={async () => {
          if (confirmar === 'revogar') await revogar.mutateAsync(integracao.id)
          else await criar()
        }}
      />
      <Dialog open={chaveNova !== null} onOpenChange={(o) => !o && setChaveNova(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('integracao.chaveNova.title')}</DialogTitle>
            <DialogDescription>
              {t('integracao.chaveNova.body', { name: integracao.nome })}
            </DialogDescription>
          </DialogHeader>
          {chaveNova && <CopyableId value={chaveNova} className="break-all" />}
          <Alert tone="warning" title={t('integracao.chaveNova.aviso')} />
          <DialogFooter>
            <Button type="button" onClick={() => setChaveNova(null)}>
              {t('integracao.chaveNova.copiei')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CadastroSecao>
  )

  async function criar() {
    const r = await gerar.mutateAsync(integracao.id).catch(() => null)
    if (r) setChaveNova(r.chave)
  }
}

/** Último contato, painel e a fila de avisos. */
function SecaoSituacao({ integracao }: { integracao: IntegracaoDetalhe }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState<TableQuery>(ORDEM_AVISOS)
  const colunas = useMemo<DataTableColumn<AvisoIntegracao>[]>(
    () => [
      {
        id: 'criadoEm',
        header: t('integracao.avisos.cols.criadoEm'),
        type: 'date',
        accessor: (r) => r.criadoEm,
        size: 160,
        cell: (r) => <span className="num">{formatDateTime(r.criadoEm)}</span>,
      },
      {
        id: 'codigo',
        header: t('integracao.avisos.cols.lote'),
        type: 'unique-text',
        accessor: (r) => r.codigo,
        size: 120,
        mobile: 'title',
        cell: (r) => <span className="font-mono">{r.codigo}</span>,
      },
      {
        id: 'enviadoEm',
        header: t('integracao.avisos.cols.enviadoEm'),
        type: 'date',
        accessor: (r) => r.enviadoEm,
        size: 160,
        cell: (r) =>
          r.enviadoEm ? (
            <span className="num">{formatDateTime(r.enviadoEm)}</span>
          ) : (
            <span className="text-muted-foreground">{t('integracao.avisos.pendente')}</span>
          ),
      },
      {
        id: 'tentativas',
        header: t('integracao.avisos.cols.tentativas'),
        type: 'number',
        accessor: (r) => r.tentativas,
        size: 110,
        cell: (r) => <span className="num">{formatNumber(r.tentativas)}</span>,
      },
      {
        id: 'erro',
        header: t('integracao.avisos.cols.erro'),
        type: 'unique-text',
        accessor: (r) => r.erro,
        size: 260,
      },
    ],
    [t],
  )
  return (
    <CadastroSecao titulo={t('integracao.secoes.situacao')} colunas={1}>
      <KeyValueList
        columns={2}
        items={[
          {
            label: t('integracao.cols.ultimoUsoEm'),
            value: integracao.ultimoUsoEm ? formatDateTime(integracao.ultimoUsoEm) : EMPTY,
          },
          {
            label: t('integracao.campos.ultimoAvisoEm'),
            value: integracao.ultimoAvisoEm ? formatDateTime(integracao.ultimoAvisoEm) : EMPTY,
          },
          {
            label: t('integracao.cols.ultimoPainelEm'),
            value: integracao.ultimoPainelEm ? formatDateTime(integracao.ultimoPainelEm) : EMPTY,
          },
          {
            label: t('integracao.cols.avisosPendentes'),
            value: <span className="num">{formatNumber(integracao.avisosPendentes)}</span>,
          },
        ]}
      />
      <DataTable
        id="integracao-avisos"
        title={t('integracao.avisos.titulo')}
        columns={colunas}
        getRowId={(r) => r.id}
        data={integracao.avisos.length ? integracao.avisos : SEM_AVISOS}
        query={query}
        onQueryChange={setQuery}
        exportName="avisos-integracao"
        empty={{ title: t('integracao.avisos.vazio') }}
      />
    </CadastroSecao>
  )
}

/** Rótulos do histórico da integração. */
function useRotulosIntegracao() {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      acoes: {
        criado: t('historico.acoes.criado'),
        editado: t('historico.acoes.editado'),
        status: t('historico.acoes.status'),
        chave_gerada: t('integracao.historico.chave_gerada'),
        chave_trocada: t('integracao.historico.chave_trocada'),
        chave_revogada: t('integracao.historico.chave_revogada'),
      },
      campos: {
        nome: t('integracao.cols.nome'),
        urlAvisos: t('integracao.campos.urlAvisos'),
        urlPainel: t('integracao.campos.urlPainel'),
        tokenPainel: t('integracao.campos.tokenPainel'),
        chave: t('integracao.cols.chave'),
        status: t('integracao.cols.status'),
      },
    }),
    [t],
  )
}
