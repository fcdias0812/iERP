import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

/* Peças usadas por mais de uma aba do cliente. */

export function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="break-all text-link underline-offset-4 hover:underline">
      {email}
    </a>
  )
}

/** Aba reservada: o conteúdo será definido depois. */
export function AbaEmDefinicao({ icon, texto }: { icon: ReactNode; texto: string }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent>
        <EmptyState icon={icon} title={t('clientes.tabs.emDefinicao')} description={texto} />
      </CardContent>
    </Card>
  )
}
