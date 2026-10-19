import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { SERVICOS } from '@/features/ordens/agendamento-schema'
import { useSitesDoCliente } from '@/features/ordens/use-ordens'
import { EMPTY, formatDate, formatNumber, formatPhone } from '@/lib/format'
import type { Ordem } from '@/services/types'

/*
 * Informações do lote (primeira aba): tudo o que foi agendado — cliente e local da coleta
 * (endereço, horário e restrições da doca vêm do cadastro do site), datas, transporte,
 * serviços, quantidades, pré-cálculo, escopo e observações. Os arquivos ficam na aba Documentos.
 */
export function AbaInformacoes({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const sites = useSitesDoCliente(o.clienteId)
  const site = sites.data?.find((s) => s.id === o.siteId)
  const doca = site?.docas.find((d) => d.id === o.docaId)
  const q = o.quantidades
  const simNao = (v: boolean) => (v ? t('dataTable.yes') : t('dataTable.no'))
  const qtd = (v: number | null) => (
    <span className="num">{v === null ? EMPTY : formatNumber(v)}</span>
  )
  const metros = (v: number | null | undefined) =>
    v == null ? null : <span className="num">{`${formatNumber(v)} m`}</span>
  const campo = (k: string) => t(`ordens.agendamento.campos.${k as 'cliente'}`)
  const servicos = SERVICOS.filter((s) => o.servicos[s])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {o.status !== 'agendado' && (
        <Alert tone="info" title={t('lotes.editar.travadoTitle')} className="lg:col-span-2">
          {t('lotes.editar.travadoBody')}
        </Alert>
      )}
      <Secao id="lote-info-local" titulo={t('lotes.informacoes.local')} className="lg:col-span-2">
        {sites.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <KeyValueList
            columns={3}
            items={[
              {
                label: campo('cliente'),
                value: (
                  <Link
                    to="/clientes/$id"
                    params={{ id: o.clienteId }}
                    search={{ aba: 'logistica' }}
                    className="text-link underline-offset-4 hover:underline"
                  >
                    {o.clienteNome}
                  </Link>
                ),
              },
              { label: campo('site'), value: <span className="font-mono">{o.siteCodigo}</span> },
              { label: campo('doca'), value: <span className="font-mono">{o.docaNumero}</span> },
              { label: t('clientes.sites.campos.endereco'), value: site?.endereco, full: true },
              { label: t('clientes.sites.campos.regiao'), value: site?.regiao },
              { label: t('clientes.sites.campos.horario'), value: site?.horario },
              {
                label: t('lotes.informacoes.contatoSite'),
                value: site?.responsavel
                  ? [site.responsavel.nome, formatPhone(site.responsavel.telefone)]
                      .filter(Boolean)
                      .join(' · ')
                  : null,
              },
              {
                label: t('clientes.sites.campos.alturaMaxCaminhao'),
                value: metros(doca?.alturaMaxCaminhao),
              },
              {
                label: t('clientes.sites.campos.comprimentoMaxCaminhao'),
                value: metros(doca?.comprimentoMaxCaminhao),
              },
              {
                label: `${t('clientes.sites.campos.dockLeveler')} / ${t('clientes.sites.campos.tailLift')}`,
                value: doca ? `${simNao(doca.dockLeveler)} / ${simNao(doca.tailLift)}` : null,
              },
            ]}
          />
        )}
      </Secao>

      <Secao id="lote-info-datas" titulo={t('lotes.informacoes.datas')}>
        <KeyValueList
          columns={2}
          items={[
            { label: campo('dataColeta'), value: formatDate(o.dataColeta) },
            {
              label: campo('coletaPrevista'),
              value: o.coletaPrevista && formatDate(o.coletaPrevista),
            },
            { label: campo('dataChegada'), value: o.dataChegada && formatDate(o.dataChegada) },
            {
              label: t('lotes.informacoes.recebidoEm'),
              value: o.recebidoEm && formatDate(o.recebidoEm),
            },
            {
              label: t('lotes.informacoes.codEmitidoEm'),
              value: o.codEmitidoEm && formatDate(o.codEmitidoEm),
            },
            { label: t('lotes.informacoes.agendadoEm'), value: formatDate(o.criadoEm) },
          ]}
        />
      </Secao>

      <Secao id="lote-info-transporte" titulo={t('lotes.informacoes.transporte')}>
        <KeyValueList
          columns={2}
          items={[
            { label: campo('transportadora'), value: o.transportadoraNome },
            {
              label: campo('referenciaCliente'),
              value: o.referenciaCliente && (
                <span className="font-mono">{o.referenciaCliente}</span>
              ),
            },
            { label: campo('rastrear'), value: simNao(o.rastrear) },
            { label: campo('motorista'), value: o.motoristaNome },
            {
              label: campo('placa'),
              value: o.placa && <span className="font-mono">{o.placa}</span>,
            },
          ]}
        />
      </Secao>

      <Secao id="lote-info-servicos" titulo={t('lotes.informacoes.servicosQuantidades')}>
        <div className="flex flex-col gap-4">
          {servicos.length ? (
            <ul
              aria-label={t('ordens.agendamento.secoes.servicos')}
              className="flex flex-col gap-1"
            >
              {servicos.map((s) => (
                <li key={s} className="type-body">
                  {t(`ordens.agendamento.servicos.${s}`)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-muted-foreground">{EMPTY}</p>
          )}
          <KeyValueList
            columns={2}
            items={[
              { label: campo('boxes'), value: qtd(q.boxes) },
              { label: campo('pallets'), value: qtd(q.pallets) },
              { label: campo('gaylords'), value: qtd(q.gaylords) },
              { label: campo('racks'), value: qtd(q.racks) },
              ...(o.servicos.valueRecoveryRacks
                ? [{ label: campo('placasPolicarbonato'), value: qtd(q.placasPolicarbonato) }]
                : []),
              {
                label: campo('requerPalletsVazios'),
                value: q.requerPalletsVazios ? (
                  <>
                    {simNao(true)} ({qtd(q.palletsVazios)})
                  </>
                ) : (
                  simNao(false)
                ),
              },
              { label: campo('itensMais25kg'), value: simNao(q.itensMais25kg) },
              { label: campo('fatorLimitante'), value: q.fatorLimitante, full: true },
            ]}
          />
        </div>
      </Secao>

      <Secao id="lote-info-calculo" titulo={t('ordens.agendamento.calculo.titulo')}>
        {o.calculo ? (
          <KeyValueList
            columns={2}
            items={[
              {
                label: t('ordens.agendamento.calculo.totalVolumes'),
                value: (
                  <span className="num">
                    {t('ordens.agendamento.calculo.volumesN', {
                      n: formatNumber(o.calculo.totalVolumes),
                    })}
                  </span>
                ),
              },
              {
                label: t('ordens.agendamento.calculo.caminhao'),
                value: t(`veiculos.tipos.${o.calculo.veiculo.tipo as 'van'}`, {
                  defaultValue: o.calculo.veiculo.tipo,
                }),
              },
              {
                label: t('ordens.agendamento.calculo.viagens'),
                value: <span className="num">{formatNumber(o.calculo.viagens)}</span>,
              },
              {
                label: t('ordens.agendamento.calculo.pessoas'),
                value: <span className="num">{formatNumber(o.calculo.totalPessoas)}</span>,
              },
              {
                label: t('ordens.agendamento.calculo.plataforma'),
                value: simNao(o.calculo.caminhaoPlataforma),
              },
              {
                label: t('ordens.agendamento.calculo.shredder'),
                value: simNao(o.calculo.levarShredder),
              },
              {
                label: t('ordens.agendamento.calculo.gaylord'),
                value: simNao(o.calculo.levarGaylordReteck),
              },
              {
                label: t('ordens.agendamento.calculo.palletVazio'),
                value: o.calculo.levarPalletsVazios
                  ? t('ordens.agendamento.calculo.simQtd', {
                      n: formatNumber(o.calculo.qtdPalletsVazios),
                    })
                  : simNao(false),
              },
            ]}
          />
        ) : (
          <p className="type-body text-muted-foreground">{t('lotes.informacoes.semCalculo')}</p>
        )}
      </Secao>

      <Secao id="lote-info-escopo" titulo={campo('escopo')}>
        <p className="type-body whitespace-pre-line">{o.escopo || EMPTY}</p>
      </Secao>
      <Secao id="lote-info-observacoes" titulo={campo('observacoes')}>
        <p className="type-body whitespace-pre-line">{o.observacoes || EMPTY}</p>
      </Secao>
    </div>
  )
}

function Secao({
  id,
  titulo,
  className,
  children,
}: {
  id: string
  titulo: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card role="region" aria-labelledby={id} className={className}>
      <CardHeader>
        <CardTitle id={id}>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
