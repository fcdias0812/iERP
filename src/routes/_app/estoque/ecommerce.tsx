import { createFileRoute } from '@tanstack/react-router'
import { tableSearchSchema } from '@/components/data-table/url-state'
import { EcommercePage } from '@/features/estoque/paginas'

/* Estoque › E-commerce (RTB WMS): lista do sistema de fora, só para ver (src/features/estoque/). */
export const Route = createFileRoute('/_app/estoque/ecommerce')({
  validateSearch: tableSearchSchema,
  component: EcommercePage,
})
