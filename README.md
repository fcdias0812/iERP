# Re-Teck iERP (versão 2)

ERP da Re-Teck focado em **logística reversa**. Esta é a versão 2, construída do zero a partir do
**template padrão de frontend** da Re-Teck (`C:\Systems\template-padrao`).

> **Status:** 1 módulo — **Administração › Usuários** (lista, detalhe com histórico, cadastro,
> edição, bloquear/desbloquear, inativar/reativar). Login ainda não definido (sessão simulada).

## Arquitetura

| Parte    | Onde                      | Tecnologias                                                                                      |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend | raiz                      | padrão do template: React 19 + TypeScript + Vite + Tailwind 4 + shadcn/ui + TanStack (ver Stack) |
| Backend  | `server/`                 | TypeScript + Node + **Express 5** · **Kysely** (SQL tipado) · **SQLite** (better-sqlite3) · Zod  |
| Banco    | `server/data/ierp.sqlite` | SQLite hoje; preparado para **PostgreSQL** (ver abaixo)                                          |

O frontend só fala com `/api` (camada `src/services/`). No desenvolvimento o Vite encaminha `/api`
para o backend (porta 3001). O contrato da API está em `src/services/types.ts` (espelhado em
`server/src/modules/<modulo>/<modulo>.types.ts`).

### Preparado para PostgreSQL

- Consultas e migrations usam o construtor do **Kysely** (não SQL de um banco específico).
- Tipos portáveis: datas em texto ISO 8601 (UTC), sim/não como 0/1, JSON em texto, ids UUID em texto.
- Para migrar: instalar `pg` e trocar o `SqliteDialect` pelo `PostgresDialect` em
  `server/src/db/database.ts` (o comentário no arquivo mostra como). Copiar os dados é um passo à parte.

## Requisitos

- Node.js **22.12+** (testado com Node 24) e npm 10+.

## Como rodar (desenvolvimento)

```bash
npm install
```

```bash
npm --prefix server install
```

```bash
npm --prefix server run db:seed
```

(cria o banco, aplica as migrations e põe 12 usuários **fictícios** — só para desenvolvimento)

Em dois terminais:

```bash
npm run dev:api
```

```bash
npm run dev
```

Abra http://localhost:5173. A API fica em http://localhost:3001/api (ex.: `/api/saude`).

### Sem backend (só telas)

`VITE_USE_MOCKS=true` liga a **API simulada** (MSW, `src/mocks/`) no navegador — útil para
demonstrar telas sem servidor. Os testes e2e usam esse modo.

## Build e produção

```bash
npm run build
```

```bash
npm --prefix server run build
```

- Frontend: arquivos estáticos em `dist/` (configure o _fallback_ para `index.html` e encaminhe
  `/api` para o backend).
- Backend: `npm --prefix server start` (roda `server/dist/index.js`; aplica as migrations ao subir).
  Variáveis: `PORT` (padrão 3001) e `DB_FILE` (padrão `server/data/ierp.sqlite`).

## Testes

```bash
npm run test
```

```bash
npm run test:api
```

```bash
npm run test:e2e
```

- `test` — unidade do frontend (Vitest).
- `test:api` — API de ponta a ponta (HTTP real + SQLite em memória; `node:test`).
- `test:e2e` — Playwright + axe-core no build com a API simulada: WCAG 2.2 AA, teclado, celular.
  Primeira vez: `npx playwright install chromium`.

## Scripts

| Script                               | O que faz                                                   |
| ------------------------------------ | ----------------------------------------------------------- |
| `npm run dev`                        | Frontend (Vite, porta 5173)                                 |
| `npm run dev:api`                    | Backend em modo observação (tsx, porta 3001)                |
| `npm run build`                      | Checagem de tipos + build do frontend em `dist/`            |
| `npm run typecheck` / `lint`         | TypeScript strict / ESLint (frontend e backend)             |
| `npm run test` / `test:api`          | Testes do frontend / da API                                 |
| `npm run test:e2e`                   | Ponta a ponta (acessibilidade, teclado, responsivo)         |
| `npm run check:contrast`             | Contraste WCAG 2.2 AA dos tokens de cor                     |
| `npm run check:colors`               | Falha se houver cor fora de token em `src/`                 |
| `npm --prefix server run db:migrate` | Aplica as migrations pendentes                              |
| `npm --prefix server run db:seed`    | Migrations + usuários fictícios (se a tabela estiver vazia) |

## Estrutura

```
src/                        FRONTEND (padrão do template)
  config/navigation.ts      menu, módulos e contexto
  config/permissions.ts     perfis × permissões
  features/admin/usuarios/  telas de Admin › Usuários (lista, detalhe, formulário)
  routes/_app/admin/usuarios/  rotas
  services/                 chamadas à API + contrato (types.ts)
  mocks/                    API simulada (opcional)
  i18n/locales/             pt-BR, en, zh-TW
server/                     BACKEND
  src/app.ts                aplicação Express (rotas em /api)
  src/db/                   conexão (database.ts), tipos das tabelas (schema.ts), migrations, seed
  src/modules/usuarios/     rotas → serviço (regras) → repositório (banco) + testes
  src/shared/               erros, consulta de tabela (filtros/ordenação → SQL), datas, texto
  data/                     arquivo do SQLite (fora do git)
```

## API de usuários

| Método e caminho                   | O que faz                                                              |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/usuarios`                | lista com busca, filtros, ordenação e paginação do DataTable           |
| `GET /api/usuarios/resumo`         | total, ativos, bloqueados, inativos                                    |
| `GET /api/usuarios/:id`            | detalhe + histórico + ações permitidas                                 |
| `POST /api/usuarios`               | cria (`nome`, `email`, `perfil`) — e-mail único (409)                  |
| `PUT /api/usuarios/:id`            | edita; o histórico guarda antes → depois                               |
| `POST /api/usuarios/:id/transicao` | `bloquear` (motivo obrigatório), `desbloquear`, `inativar`, `reativar` |
| `GET /api/busca?q=`                | busca global (Ctrl+K)                                                  |

Erros seguem `{ code, message, details? }` (ex.: `validation` 422, `email_in_use` 409,
`invalid_transition` 409, `not_found` 404).

## Pendências conhecidas

- **Login/autenticação** não definido: a sessão do frontend é simulada e o histórico grava
  "Sistema" como autor (`server/src/shared/autor.ts`). As permissões por perfil só são
  conferidas na tela.
- Notificações: a API devolve lista vazia. Foto de perfil: responde 501 (depende do login).

## Stack do frontend

React 19 + TypeScript (strict) · Vite · Tailwind CSS 4 · shadcn/ui (Radix) · lucide-react ·
TanStack Router / Query / Table / Virtual · Zustand · React Hook Form + Zod · i18next · MSW ·
Vitest + Testing Library · Playwright + axe-core · ESLint + Prettier. Versões exatas no
`package.json`; regras de uso em [`CLAUDE.md`](CLAUDE.md) e [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).
