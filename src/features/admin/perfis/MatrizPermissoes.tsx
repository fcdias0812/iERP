import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Eye, Pencil, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { GRUPOS_DE_PAGINAS, type GrupoDePaginas } from '@/config/paginas'
import type { NivelAcesso } from '@/config/permissions'

/*
 * Matriz do perfil de acesso: cada página do menu (agrupada como no menu) com o nível
 * Sem acesso / Visualizar / Editar, e "Aplicar a todas" em cada grupo.
 */

export type NivelOuNenhum = NivelAcesso | 'nenhum'
export type Matriz = Record<string, NivelOuNenhum>

const NIVEIS: NivelOuNenhum[] = ['nenhum', 'ver', 'editar']
const ICONE_NIVEL = { nenhum: Ban, ver: Eye, editar: Pencil } as const

export function MatrizPermissoes({
  valor,
  onChange,
  somenteLeitura,
}: {
  valor: Matriz
  onChange: (v: Matriz) => void
  somenteLeitura?: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {GRUPOS_DE_PAGINAS.map((g) => (
        <Grupo
          key={g.id}
          grupo={g}
          valor={valor}
          onChange={onChange}
          somenteLeitura={somenteLeitura}
        />
      ))}
    </div>
  )
}

function Grupo({
  grupo,
  valor,
  onChange,
  somenteLeitura,
}: {
  grupo: GrupoDePaginas
  valor: Matriz
  onChange: (v: Matriz) => void
  somenteLeitura?: boolean
}) {
  const { t } = useTranslation()
  const tituloId = useId()
  const titulo = t(grupo.labelKey)
  const aplicar = (nivel: NivelOuNenhum) =>
    onChange({ ...valor, ...Object.fromEntries(grupo.paginas.map((p) => [p.chave, nivel])) })

  return (
    <section aria-labelledby={tituloId} className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <h3 id={tituloId} className="type-card-title">
          {titulo}
        </h3>
        {!somenteLeitura && grupo.paginas.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {t('perfis.aplicarTodas')}
                <span className="sr-only"> — {titulo}</span>
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {NIVEIS.map((n) => {
                const Icone = ICONE_NIVEL[n]
                return (
                  <DropdownMenuItem key={n} onSelect={() => aplicar(n)}>
                    <Icone aria-hidden />
                    {t(`perfis.niveis.${n}`)}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <ul className="flex flex-col">
        {grupo.paginas.map((p) => (
          <LinhaPagina
            key={p.chave}
            grupoId={tituloId}
            chave={p.chave}
            rotulo={t(p.labelKey)}
            nivel={valor[p.chave] ?? 'nenhum'}
            onChange={(n) => onChange({ ...valor, [p.chave]: n })}
            somenteLeitura={somenteLeitura}
          />
        ))}
      </ul>
    </section>
  )
}

function LinhaPagina({
  grupoId,
  chave,
  rotulo,
  nivel,
  onChange,
  somenteLeitura,
}: {
  /** id do título do grupo: o nome lido é "Ordens Lotes" (há "Lotes" em Ordens e em Operação). */
  grupoId: string
  chave: string
  rotulo: string
  nivel: NivelOuNenhum
  onChange: (n: NivelOuNenhum) => void
  somenteLeitura?: boolean
}) {
  const { t } = useTranslation()
  const rotuloId = useId()
  return (
    <li
      className="flex flex-col gap-2 border-b py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
      data-pagina={chave}
    >
      <span id={rotuloId} className="type-body font-medium">
        {rotulo}
      </span>
      <RadioGroup
        aria-labelledby={`${grupoId} ${rotuloId}`}
        value={nivel}
        onValueChange={(v) => onChange(v as NivelOuNenhum)}
        disabled={somenteLeitura}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        {NIVEIS.map((n) => {
          const id = `${rotuloId}-${n}`
          return (
            <div key={n} className="flex min-h-6 items-center gap-2">
              <RadioGroupItem id={id} value={n} />
              <label htmlFor={id} className="cursor-pointer type-body">
                {t(`perfis.niveis.${n}`)}
              </label>
            </div>
          )
        })}
      </RadioGroup>
    </li>
  )
}
