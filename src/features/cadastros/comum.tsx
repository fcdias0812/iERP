import { Skeleton } from '@/components/ui/skeleton'

/** Enquanto o registro carrega (o painel abre em seguida). */
export function PainelCarregando() {
  return (
    <div className="sr-only" aria-busy>
      <Skeleton />
    </div>
  )
}
