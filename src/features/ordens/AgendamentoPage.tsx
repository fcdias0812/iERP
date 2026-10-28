import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { RequirePermission } from '@/components/layout/RequirePermission'
import { FormPage } from '@/components/patterns/FormPage'
import { Button } from '@/components/ui/button'
import { Anexos, Coleta, Local, Quantidades, Rastreio, Servicos } from './agendamento-campos'
import {
  agendamentoSchema,
  chaveDoCalculo,
  dia,
  errosDoCliente,
  formParaInput,
  novoAgendamento,
  quantidadesParaApi,
  type AgendamentoForm,
} from './agendamento-schema'
import { PreCalculoCard } from './PreCalculoCard'
import { useAplicarPadroesDoCliente, useRegrasDoCliente } from './regras-do-cliente'
import { useColetaDoAgendamento, useCriarOrdem, usePreCalculo } from './use-ordens'

/*
 * Ordens › Agendamento — o ÚNICO cadastro com página própria (decisão do usuário): o formulário
 * é longo e o pré-cálculo fica ao lado. Criar a ordem gera o lote agendado (Ordens › Lotes).
 */

export function AgendamentoPage() {
  return (
    <RequirePermission permission="ordens.agendamento.criar">
      <Agendamento />
    </RequirePermission>
  )
}

function Agendamento() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const form = useForm<AgendamentoForm>({
    resolver: zodResolver(agendamentoSchema),
    mode: 'onTouched',
    defaultValues: novoAgendamento(),
  })
  // Aba Configurações do cliente escolhido: padrões ao escolher e regras ao enviar.
  const regras = useRegrasDoCliente(form)
  useAplicarPadroesDoCliente(form, regras)
  const criar = useCriarOrdem()
  const calculo = usePreCalculo()
  const [calculadoCom, setCalculadoCom] = useState<string | null>(null)
  const valores = useWatch({ control: form.control }) as AgendamentoForm
  // A mesma coleta de um lote que já existe (28/10/2026): avisa e vai com os caminhões dele.
  const coleta = useColetaDoAgendamento({
    clienteId: valores.clienteId,
    siteId: valores.siteId,
    dia: dia(valores.dataColeta ?? valores.coletaPrevista),
  }).data
  const juntoCom = useRef<string | null>(null)
  useEffect(() => {
    // Achou a coleta com caminhão: o rastreio do lote novo vem desligado (uma vez por coleta).
    if (!coleta?.caminhoes.length || juntoCom.current === coleta.id) return
    juntoCom.current = coleta.id
    form.setValue('rastrear', false, { shouldDirty: true })
  }, [coleta, form])

  const preCalcular = () => {
    const v = form.getValues()
    if (!v.docaId) {
      void form.trigger(['clienteId', 'siteId', 'docaId'])
      return
    }
    setCalculadoCom(chaveDoCalculo(v))
    calculo.mutate({
      docaId: v.docaId,
      servicos: v.servicos,
      quantidades: quantidadesParaApi(v),
    })
  }

  const enviar = form.handleSubmit(async (v) => {
    const erros = errosDoCliente(v, regras, { novo: true })
    if (erros.length) {
      for (const e of erros) form.setError(e.campo, { message: e.mensagem })
      return
    }
    const ordem = await criar
      .mutateAsync({
        dados: formParaInput(v),
        arquivos: { escopo: v.escopoArquivos, observacoes: v.observacoesArquivos },
      })
      .catch(() => null)
    if (!ordem) return
    form.reset(v) // limpa o "sujo" antes de sair
    void navigate({ to: '/ordens/lotes' })
  })

  return (
    <FormPage
      title={t('ordens.agendamento.title')}
      description={t('ordens.agendamento.description')}
      onSubmit={() => void enviar()}
      onCancel={() => void navigate({ to: '/ordens/lotes' })}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
      submitLabel={t('ordens.agendamento.criar')}
      extraActions={
        <Button type="button" variant="secondary" onClick={preCalcular} loading={calculo.isPending}>
          {!calculo.isPending && <Calculator aria-hidden />}
          {t('ordens.agendamento.preCalcular')}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Local form={form} />
          <Coleta form={form} />
          <Rastreio form={form} coleta={coleta} />
          <Servicos form={form} />
          <Quantidades form={form} />
          <Anexos form={form} />
        </div>
        <PreCalculoCard
          calculo={calculo.data ?? null}
          erro={calculo.error}
          calculando={calculo.isPending}
          semDoca={!valores.docaId}
          desatualizado={
            Boolean(calculo.data) &&
            calculadoCom !== null &&
            calculadoCom !== chaveDoCalculo(valores)
          }
          onCalcular={preCalcular}
        />
      </div>
    </FormPage>
  )
}
