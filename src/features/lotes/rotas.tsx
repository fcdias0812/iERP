import { LoteDetailPage } from './LoteDetailPage'
import { LotesListPage } from './LotesListPage'

/* Telas das rotas de lote: o mesmo lote em Ordens › Lotes e em Operação › Lotes. */

export const LotesOrdensPage = () => <LotesListPage origem="ordens" />
export const LotesOperacaoPage = () => <LotesListPage origem="operacao" />
export const LoteOrdensPage = () => <LoteDetailPage origem="ordens" />
export const LoteOperacaoPage = () => <LoteDetailPage origem="operacao" />
