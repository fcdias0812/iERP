import { randomUUID } from 'node:crypto'
import type { Transaction } from 'kysely'
import { z } from 'zod'
import type { Database } from '../db/schema.js'
import { codigoCom, proximoNumero } from '../shared/cadastro.js'
import {
  cnpjValido,
  cpfValido,
  formatarCnpj,
  limparCpf,
  limparTelefone,
  soAlfanumerico,
  telefoneValido,
} from '../shared/documentos.js'
import { ErroApi } from '../shared/erros.js'
import { registrarHistorico } from '../shared/historico.repositorio.js'
import { normalizar } from '../shared/texto.js'

/*
 * Inclusão básica de transportadora e de motorista — usada pelos dois cadastros para o
 * "não está na lista? cria agora" (motorista novo dentro da transportadora e vice-versa).
 */

type Trx = Transaction<Database>

export const transportadoraBasicaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome da transportadora.').max(160),
  cnpj: z.string().transform(soAlfanumerico).refine(cnpjValido, 'CNPJ inválido.'),
})

export const motoristaBasicoSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo do motorista.').max(160),
  cpf: z.string().transform(limparCpf).refine(cpfValido, 'CPF inválido.'),
  telefone: z
    .string()
    .transform(limparTelefone)
    .refine(telefoneValido, 'Telefone do motorista inválido (DDD + número).'),
})

export type TransportadoraBasica = z.output<typeof transportadoraBasicaSchema>
export type MotoristaBasico = z.output<typeof motoristaBasicoSchema>

export const cnpjEmUso = () =>
  new ErroApi(409, 'cnpj_in_use', 'Já existe uma transportadora com este CNPJ.')
export const cpfEmUso = () => new ErroApi(409, 'cpf_in_use', 'Já existe um motorista com este CPF.')

/** Busca geral da transportadora: nome, CNPJ (com e sem pontuação), código e contatos. */
export const buscaTransportadora = (
  t: { nome: string; cnpj: string; codigo: string },
  contatos: { nome: string | null; email: string; telefone: string }[] = [],
) =>
  normalizar(
    [
      t.nome,
      t.cnpj,
      formatarCnpj(t.cnpj),
      t.codigo,
      ...contatos.flatMap((k) => [k.nome ?? '', k.email, k.telefone]),
    ].join(' '),
  )

export const buscaMotorista = (m: {
  nome: string
  cpf: string
  telefone: string
  codigo: string
}) => normalizar([m.nome, m.cpf, m.telefone, m.codigo].join(' '))

/** Cria transportadora (sem contatos). Lança 409 se o CNPJ já existir. */
export async function inserirTransportadora(
  trx: Trx,
  dados: TransportadoraBasica,
  autor: string,
): Promise<string> {
  if (
    await trx
      .selectFrom('transportadoras')
      .select('id')
      .where('cnpj', '=', dados.cnpj)
      .executeTakeFirst()
  )
    throw cnpjEmUso()
  const id = randomUUID()
  const numero = await proximoNumero(trx, 'transportadoras')
  const codigo = codigoCom('TRA', numero)
  const agora = new Date().toISOString()
  await trx
    .insertInto('transportadoras')
    .values({
      id,
      numero,
      codigo,
      nome: dados.nome,
      cnpj: dados.cnpj,
      status: 'ativo',
      busca: buscaTransportadora({ ...dados, codigo }),
      criadoEm: agora,
      criadoPor: autor,
      alteradoEm: agora,
      alteradoPor: autor,
    })
    .execute()
  await registrarHistorico(trx, 'transportadora', id, { autor, em: agora, acao: 'criado' })
  return id
}

/** Cria motorista (vinculado ou não). Lança 409 se o CPF já existir. */
export async function inserirMotorista(
  trx: Trx,
  dados: MotoristaBasico & { transportadoraId: string | null },
  autor: string,
): Promise<string> {
  if (
    await trx.selectFrom('motoristas').select('id').where('cpf', '=', dados.cpf).executeTakeFirst()
  )
    throw cpfEmUso()
  const id = randomUUID()
  const numero = await proximoNumero(trx, 'motoristas')
  const codigo = codigoCom('MOT', numero)
  const agora = new Date().toISOString()
  await trx
    .insertInto('motoristas')
    .values({
      id,
      numero,
      codigo,
      nome: dados.nome,
      cpf: dados.cpf,
      telefone: dados.telefone,
      transportadoraId: dados.transportadoraId,
      status: 'ativo',
      busca: buscaMotorista({ ...dados, codigo }),
      criadoEm: agora,
      criadoPor: autor,
      alteradoEm: agora,
      alteradoPor: autor,
    })
    .execute()
  await registrarHistorico(trx, 'motorista', id, { autor, em: agora, acao: 'criado' })
  return id
}
