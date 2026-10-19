import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { KeyValueItem } from '@/components/ui/metadata'
import { SERVICOS } from '@/features/ordens/agendamento-schema'
import { useSitesDoCliente } from '@/features/ordens/use-ordens'
import { EMPTY, formatDate, formatNumber, formatPhone } from '@/lib/format'
import type { Ordem } from '@/services/types'

/*
 * As informações do lote, por seção (local, datas, transporte, serviços e quantidades,
 * pré-cálculo) — a mesma lista na aba Informações do lote e na janela do card do Forecast
 * (Operação › Dashboard). Endereço, horário e restrições da doca vêm do cadastro do site.
 */
export function useInformacoesDoLote(o: Ordem) {
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

  const local: KeyValueItem[] = [
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
    {
      label: t('clientes.sites.campos.regiao'),
      value: site?.regiao ? t(`clientes.sites.regioes.${site.regiao}`) : null,
    },
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
  ]

  const datas: KeyValueItem[] = [
    { label: campo('coletaPrevista'), value: formatDate(o.coletaPrevista) },
    { label: campo('dataColeta'), value: o.dataColeta && formatDate(o.dataColeta) },
    { label: campo('dataChegada'), value: o.dataChegada && formatDate(o.dataChegada) },
    { label: t('lotes.informacoes.recebidoEm'), value: o.recebidoEm && formatDate(o.recebidoEm) },
    {
      label: t('lotes.informacoes.codEmitidoEm'),
      value: o.codEmitidoEm && formatDate(o.codEmitidoEm),
    },
    { label: t('lotes.informacoes.agendadoEm'), value: formatDate(o.criadoEm) },
  ]

  const transporte: KeyValueItem[] = [
    { label: campo('transportadora'), value: o.transportadoraNome },
    {
      label: campo('referenciaCliente'),
      value: o.referenciaCliente && <span className="font-mono">{o.referenciaCliente}</span>,
    },
    { label: campo('rastrear'), value: simNao(o.rastrear) },
    { label: campo('motorista'), value: o.motoristaNome },
    { label: campo('placa'), value: o.placa && <span className="font-mono">{o.placa}</span> },
  ]

  const servicos = SERVICOS.filter((s) => o.servicos[s]).map((s) =>
    t(`ordens.agendamento.servicos.${s}`),
  )

  const quantidades: KeyValueItem[] = [
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
  ]

  const c = o.calculo
  const calculo: KeyValueItem[] | null = c && [
    {
      label: t('ordens.agendamento.calculo.totalVolumes'),
      value: (
        <span className="num">
          {t('ordens.agendamento.calculo.volumesN', { n: formatNumber(c.totalVolumes) })}
        </span>
      ),
    },
    {
      label: t('ordens.agendamento.calculo.caminhao'),
      value: t(`veiculos.tipos.${c.veiculo.tipo as 'van'}`, { defaultValue: c.veiculo.tipo }),
    },
    {
      label: t('ordens.agendamento.calculo.viagens'),
      value: <span className="num">{formatNumber(c.viagens)}</span>,
    },
    {
      label: t('ordens.agendamento.calculo.pessoas'),
      value: <span className="num">{formatNumber(c.totalPessoas)}</span>,
    },
    { label: t('ordens.agendamento.calculo.plataforma'), value: simNao(c.caminhaoPlataforma) },
    { label: t('ordens.agendamento.calculo.shredder'), value: simNao(c.levarShredder) },
    { label: t('ordens.agendamento.calculo.gaylord'), value: simNao(c.levarGaylordReteck) },
    {
      label: t('ordens.agendamento.calculo.palletVazio'),
      value: c.levarPalletsVazios
        ? t('ordens.agendamento.calculo.simQtd', { n: formatNumber(c.qtdPalletsVazios) })
        : simNao(false),
    },
  ]

  return {
    carregandoSite: sites.isPending,
    local,
    datas,
    transporte,
    servicos,
    quantidades,
    calculo,
  }
}
