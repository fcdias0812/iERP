import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/ui/status-badge'
import { CadastroSheet } from '@/features/comum/CadastroSheet'
import {
  Anexos,
  Coleta,
  Local,
  Quantidades,
  Rastreio,
  Servicos,
} from '@/features/ordens/agendamento-campos'
import {
  chaveDoCalculo,
  criarAgendamentoSchema,
  errosDoCliente,
  formParaInput,
  ordemParaForm,
  quantidadesParaApi,
  type AgendamentoForm,
} from '@/features/ordens/agendamento-schema'
import { PreCalculoCard } from '@/features/ordens/PreCalculoCard'
import { useRegrasDoCliente } from '@/features/ordens/regras-do-cliente'
import { SecaoContexto } from '@/features/ordens/secao-contexto'
import { useEditarLote, usePreCalculo } from '@/features/ordens/use-ordens'
import type { Ordem } from '@/services/types'

/*
 * Editar o lote (painel lateral, padrão de cadastro) — decisões do usuário: tudo menos o
 * cliente, só enquanto AGENDADO, e o pré-cálculo é refeito ao salvar. Mesmos campos e regras do
 * Agendamento; os arquivos ficam na aba Documentos.
 */

export function LoteSheet({
  lote,
  permissao,
  onClose,
}: {
  lote: Ordem
  permissao: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const salvar = useEditarLote(lote.id)
  const calculo = usePreCalculo()
  const temEscopoArquivado = lote.anexos.some((a) => a.tipo === 'escopo')
  const schema = useMemo(() => criarAgendamentoSchema({ temEscopoArquivado }), [temEscopoArquivado])
  const inicial = useMemo(() => ordemParaForm(lote), [lote])
  const form = useForm<AgendamentoForm>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: inicial,
  })
  // Regras do cliente (aba Configurações), conferidas ao salvar.
  const regras = useRegrasDoCliente(form)
  // O cálculo guardado vale para os dados iniciais; muda quando a pessoa recalcula.
  const [calculadoCom, setCalculadoCom] = useState(() => chaveDoCalculo(inicial))
  const valores = useWatch({ control: form.control }) as AgendamentoForm

  const preCalcular = () => {
    const v = form.getValues()
    if (!v.docaId) {
      void form.trigger(['siteId', 'docaId'])
      return
    }
    setCalculadoCom(chaveDoCalculo(v))
    calculo.mutate({ docaId: v.docaId, servicos: v.servicos, quantidades: quantidadesParaApi(v) })
  }

  const enviar = form.handleSubmit(async (v) => {
    const erros = errosDoCliente(v, regras, { novo: false })
    if (erros.length) {
      for (const e of erros) form.setError(e.campo, { message: e.mensagem })
      return
    }
    const salvo = await salvar.mutateAsync(formParaInput(v)).catch(() => null)
    if (salvo) {
      form.reset(v)
      onClose()
    }
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={t('lotes.editar.titulo', { code: lote.codigo })}
      descricao={t('lotes.editar.descricao')}
      status={<StatusBadge status={lote.status} />}
      formId="form-lote"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao={permissao}
      dados={
        <form
          id="form-lote"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <SecaoContexto.Provider value="painel">
            <Local form={form} clienteFixo />
            <Coleta form={form} />
            <Rastreio form={form} />
            <Servicos form={form} />
            <Quantidades form={form} />
            <Anexos form={form} semArquivos />
          </SecaoContexto.Provider>
          <div className="flex flex-col gap-2">
            <PreCalculoCard
              calculo={calculo.data ?? lote.calculo}
              erro={calculo.error}
              calculando={calculo.isPending}
              semDoca={!valores.docaId}
              desatualizado={calculadoCom !== chaveDoCalculo(valores)}
              onCalcular={preCalcular}
            />
            <p className="type-caption text-muted-foreground">{t('lotes.editar.calculoAjuda')}</p>
          </div>
        </form>
      }
    />
  )
}
