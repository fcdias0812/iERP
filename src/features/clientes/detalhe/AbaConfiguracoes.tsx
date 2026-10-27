import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { CircleCheck, CircleMinus, Pencil } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TextoTraduzido } from '@/components/ui/localized-text'
import { KeyValueList, type KeyValueItem } from '@/components/ui/metadata'
import { useNomeDoTipo } from '@/features/lotes/tipos-documento'
import { SERVICOS } from '@/features/ordens/agendamento-schema'
import { formatNumber } from '@/lib/format'
import type { Cliente } from '@/services/types'
import { NOME_SISTEMA } from '../configuracoes'
import { ConfiguracoesSheet } from './ConfiguracoesSheet'

/*
 * Clientes › Configurações (pedido do usuário, 22/10/2026): como as coletas, o agendamento, o
 * recebimento e os prazos deste cliente funcionam. Aqui só se vê; editar abre o painel lateral.
 */
export function AbaConfiguracoes({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const [editando, setEditando] = useState(false)
  const nomeDoTipo = useNomeDoTipo()
  const cfg = c.configuracoes
  const campo = (k: string) => t(`clientes.config.campos.${k as 'rastrearColeta'}`)
  const dias = (n: number | null, vazio: string) =>
    n === null ? (
      <span className="text-muted-foreground">{vazio}</span>
    ) : (
      <span className="num">{t('clientes.config.valores.dias', { n: formatNumber(n) })}</span>
    )
  const simNao = (v: boolean): ReactNode => (
    <span className="inline-flex items-center gap-1.5">
      {v ? (
        <CircleCheck aria-hidden className="size-4 text-info" />
      ) : (
        <CircleMinus aria-hidden className="size-4 text-muted-foreground" />
      )}
      {v ? t('dataTable.yes') : t('dataTable.no')}
    </span>
  )

  const rastreio: KeyValueItem[] = [
    { label: campo('rastrearColeta'), value: simNao(cfg.rastrearColeta) },
    { label: campo('rastreioExcecao'), value: simNao(cfg.rastreioExcecao) },
    { label: campo('exigirMotoristaPlaca'), value: simNao(cfg.exigirMotoristaPlaca) },
  ]
  const servicos = cfg.servicosPadrao
    ? SERVICOS.filter((s) => cfg.servicosPadrao![s]).map((s) =>
        t(`ordens.agendamento.servicos.${s}`),
      )
    : null
  const agendamento: KeyValueItem[] = [
    {
      label: campo('servicosPadrao'),
      value: servicos ? (
        servicos.length ? (
          <ul className="flex flex-col gap-0.5">
            {servicos.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          t('clientes.config.valores.nenhum')
        )
      ) : (
        <span className="text-muted-foreground">{t('clientes.config.valores.padraoSistema')}</span>
      ),
    },
    {
      label: campo('transportadoraPadrao'),
      value: cfg.transportadoraPadraoNome ?? (
        <span className="text-muted-foreground">{t('clientes.config.valores.nenhuma')}</span>
      ),
    },
    { label: campo('exigirEscopoPlanilha'), value: simNao(cfg.exigirEscopoPlanilha) },
    {
      label: campo('instrucoes'),
      value: cfg.instrucoes ? (
        <TextoTraduzido valor={cfg.instrucoes} className="whitespace-pre-line" />
      ) : null,
      full: true,
    },
  ]
  const recebimento: KeyValueItem[] = [
    { label: campo('exigirLacre'), value: simNao(cfg.exigirLacre) },
    { label: campo('exigirNota'), value: simNao(cfg.exigirNota) },
    { label: campo('exigirTara'), value: simNao(cfg.exigirTara) },
    { label: campo('exigirFotosGerais'), value: simNao(cfg.exigirFotosGerais) },
  ]
  const nomes = (l: typeof cfg.documentos) =>
    l.length ? (
      l.map((d) => nomeDoTipo(d.codigo, d.nome)).join(', ')
    ) : (
      <span className="text-muted-foreground">{t('clientes.config.valores.nenhum')}</span>
    )
  const documentos: KeyValueItem[] = [
    {
      label: t('clientes.config.documentos.aceitos'),
      value: nomes(cfg.documentos.filter((d) => d.aceita)),
    },
    {
      label: t('clientes.config.documentos.noRelatorio'),
      value: nomes(cfg.documentos.filter((d) => d.relatorio)),
    },
  ]
  const prazos: KeyValueItem[] = [
    {
      label: campo('sistemaProcessamento'),
      value: cfg.sistemaProcessamento
        ? (NOME_SISTEMA[cfg.sistemaProcessamento] ?? cfg.sistemaProcessamento)
        : t('clientes.config.valores.processadoAqui'),
    },
    { label: campo('slaDias'), value: dias(cfg.slaDias, t('clientes.config.valores.semSla')) },
    {
      label: campo('diasParadoEtapa'),
      value: dias(cfg.diasParadoEtapa, t('clientes.config.valores.semLimite')),
    },
    {
      label: campo('antecedenciaDias'),
      value: dias(cfg.antecedenciaDias, t('clientes.config.valores.semLimite')),
    },
    { label: campo('agendamentoBloqueado'), value: simNao(cfg.agendamentoBloqueado) },
    ...(cfg.agendamentoBloqueado
      ? [{ label: campo('bloqueioMotivo'), value: cfg.bloqueioMotivo, full: true }]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-body text-muted-foreground">{t('clientes.config.intro')}</p>
        <Can permission="clientes.editar" fallback="disable">
          <Button variant="secondary" onClick={() => setEditando(true)}>
            <Pencil aria-hidden />
            {t('clientes.config.editar')}
          </Button>
        </Can>
      </div>
      {cfg.agendamentoBloqueado && (
        <Alert tone="inactive" title={t('clientes.config.bloqueadoTitulo')}>
          {cfg.bloqueioMotivo}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Secao titulo={t('clientes.config.secoes.rastreio')}>
          <KeyValueList columns={1} items={rastreio} />
        </Secao>
        <Secao titulo={t('clientes.config.secoes.recebimento')}>
          <KeyValueList columns={2} items={recebimento} />
        </Secao>
        <Secao titulo={t('clientes.config.secoes.agendamento')}>
          <KeyValueList columns={2} items={agendamento} />
        </Secao>
        <Secao titulo={t('clientes.config.secoes.prazos')}>
          <KeyValueList columns={2} items={prazos} />
        </Secao>
        <Secao titulo={t('clientes.config.secoes.documentos')} className="lg:col-span-2">
          <KeyValueList columns={2} items={documentos} />
        </Secao>
      </div>
      {editando && <ConfiguracoesSheet c={c} onClose={() => setEditando(false)} />}
    </div>
  )
}

function Secao({
  titulo,
  className,
  children,
}: {
  titulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
