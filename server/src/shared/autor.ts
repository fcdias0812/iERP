/**
 * Quem está fazendo a alteração (vai para o histórico).
 * PROVISÓRIO: o login ainda não foi definido. Quando houver autenticação, devolver o nome
 * do usuário autenticado da requisição.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- usará a requisição quando houver login
export function autorDa(_req: import('express').Request): string {
  return 'Sistema'
}
