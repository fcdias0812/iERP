# Re-Teck iERP (versão 2)

ERP da Re-Teck focado em **logística reversa**. Esta é a versão 2, construída do zero a partir do
**template padrão de frontend** da Re-Teck (https://github.com/fcdias0812/template-padrao).

Repositório: https://github.com/fcdias0812/iERP

> **Continuar o desenvolvimento com o Claude (outro PC ou outra sessão):** clone o repositório, abra a
> pasta no Claude Code e rode o skill **`/retomar`**. Todo o contexto — as ordens do usuário, as
> decisões de cada módulo, o estado atual, as perguntas em aberto e o jeito de construir — está em
> [`.claude/CONTEXTO.md`](.claude/CONTEXTO.md) e [`.claude/FLUXO-DE-TRABALHO.md`](.claude/FLUXO-DE-TRABALHO.md).

> **Status:** menu **Relacionamento** com **Clientes** (cadastro com CNPJ e contatos; detalhe em
> abas: visão geral com lotes, contatos, logística com sites/docas e mapa, documentos,
> configurações, histórico em tabela), **Transportadoras** (contatos e motoristas), **Veículos**
> (tipo, medidas e capacidade) e **Motoristas**; menu **Operação** com **Ordens › Lotes**
> (lotes agendados) e **Ordens › Agendamento** (cria o lote, com pré-cálculo de caminhão, viagens
> e pessoas), **Operação › Dashboard** (cards de SLA, previsão de chegada, mapa dos datacenters
> Microsoft, situação por cliente, anomalias de prazo) — as demais telas de Operação e Estoque
> estão "em construção"; e
> **Administração › Usuários**. Pendentes: aba Configurações (a definir) e a integração
> de lotes com os sistemas de produção. Login ainda não definido (sessão simulada).

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

(cria o banco, aplica as migrations e põe dados **fictícios** — usuários, clientes, transportadoras,
motoristas e veículos — só para desenvolvimento)

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

| Script                                | O que faz                                                         |
| ------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                         | Frontend (Vite, porta 5173)                                       |
| `npm run dev:api`                     | Backend em modo observação (tsx, porta 3001)                      |
| `npm run build`                       | Checagem de tipos + build do frontend em `dist/`                  |
| `npm run typecheck` / `lint`          | TypeScript strict / ESLint (frontend e backend)                   |
| `npm run test` / `test:api`           | Testes do frontend / da API                                       |
| `npm run test:e2e`                    | Ponta a ponta (acessibilidade, teclado, responsivo)               |
| `npm run check:contrast`              | Contraste WCAG 2.2 AA dos tokens de cor                           |
| `npm run check:colors`                | Falha se houver cor fora de token em `src/`                       |
| `npm --prefix server run db:migrate`  | Aplica as migrations pendentes                                    |
| `npm --prefix server run db:seed`     | Migrations + dados fictícios (só nas tabelas vazias)              |
| `npm --prefix server run db:desfazer` | Desfaz a última migration (só dev; migration ainda não commitada) |

## Estrutura

```
src/                        FRONTEND (padrão do template)
  config/navigation.ts      menu, módulos e contexto
  config/permissions.ts     perfis × permissões
  features/clientes/        telas de Clientes (lista, detalhe com abas, formulário com contatos)
  features/transportadoras/ Transportadoras (lista, detalhe com abas, formulário com contatos e motoristas)
  features/motoristas/      Motoristas (lista + painel lateral)
  features/veiculos/        Veículos (lista + painel lateral)
  features/ordens/          Ordens › Agendamento (página própria + pré-cálculo) e hooks de ordens
  features/lotes/           lista dos lotes (Ordens › Lotes = Operação › Lotes) e detalhe do lote
                            (Informações, Progresso, Ocorrências, Documentos, Histórico)
  features/comum/           peças compartilhadas: contatos, histórico (auditoria), painel de cadastro
                            (CadastroSheet — todo cadastro/edição abre no painel lateral à direita)
  features/admin/usuarios/  telas de Admin › Usuários (lista, detalhe, formulário)
  routes/_app/              rotas (clientes/, transportadoras/, motoristas/, veiculos/, ordens/, operacao/, admin/usuarios/)
  services/                 chamadas à API + contrato (types.ts)
  mocks/                    API simulada (opcional)
  i18n/locales/             pt-BR, en, zh-TW
server/                     BACKEND
  src/app.ts                aplicação Express (rotas em /api)
  src/db/                   conexão (database.ts), tipos das tabelas (schema.ts), migrations, seed
  src/modules/<modulo>/     clientes, usuarios: rotas → serviço (regras) → repositório (banco) + testes
                            transportadoras, motoristas, veiculos: um arquivo por módulo (cadastros
                            simples) + relacionamento.basico.ts (inclusão rápida) e relacionamento.test.ts
  src/shared/               erros, consulta de tabela (filtros/ordenação → SQL), datas, texto,
                            documentos (CNPJ, telefone), histórico
  data/                     arquivo do SQLite (fora do git)
```

## API de clientes

| Método e caminho                                  | O que faz                                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/clientes`                               | lista (com o contato principal) — busca, filtros, ordenação, paginação                                   |
| `GET /api/clientes/resumo`                        | total, ativos, inativos                                                                                  |
| `GET /api/clientes/:id`                           | detalhe + contatos + histórico + ações permitidas                                                        |
| `POST /api/clientes`                              | cria (`nome`, `cnpj`, `contatos[]`) — CNPJ único (409)                                                   |
| `PUT /api/clientes/:id`                           | edita; contato com `id` é mantido (vínculo com sites); histórico antes → depois                          |
| `POST /api/clientes/:id/transicao`                | `inativar`, `reativar`                                                                                   |
| `GET /api/clientes/:id/lotes/resumo`              | lotes a chegar / em operação / finalizados + últimos 5 (integração ainda não ligada: `conectado: false`) |
| `GET/POST /api/clientes/:id/sites`                | sites (com docas e responsável); responsável existente ou contato novo                                   |
| `PUT/DELETE /api/clientes/:id/sites/:siteId`      | edita / remove site (docas juntas)                                                                       |
| `GET/POST /api/clientes/:id/documentos`           | lista / envia (multipart `arquivo` + `tipo`), até 25 MB                                                  |
| `GET /api/clientes/:id/documentos/:docId/arquivo` | baixa (sempre como anexo)                                                                                |
| `DELETE /api/clientes/:id/documentos/:docId`      | remove                                                                                                   |
| `GET /api/geo/cep/:cep`                           | CEP → endereço e região (ViaCEP)                                                                         |
| `GET /api/geo/endereco?q=`                        | endereço → latitude/longitude (Nominatim/OpenStreetMap, 1 consulta/s, com cache)                         |

CNPJ (numérico ou alfanumérico) e telefone são guardados **sem pontuação** e validados no
servidor; cada cliente tem **um** contato principal. Cliente não é excluído: é inativado.
Tudo o que muda no cliente (dados, contatos, sites, documentos) vai para o histórico dele.

**Documentos:** tipos `contrato`, `fiscal`, `licenca`, `outro`; extensões PDF, DOC/DOCX, XLS/XLSX,
CSV, TXT, XML, JPG/JPEG, PNG, WEBP e ZIP. Os arquivos ficam em `server/data/arquivos` (variável
`ARQUIVOS_DIR`), fora do git — **inclua essa pasta no backup**, junto do banco.

**Mapa e localização:** o mapa usa os tiles públicos do OpenStreetMap (crédito visível, sem uso
pesado — [política](https://operations.osmfoundation.org/policies/tiles/)); para outro provedor,
`VITE_MAP_TILES_URL` e `VITE_MAP_TILES_ATTRIBUTION`. Endereço → coordenadas passa pelo servidor,
que respeita a [política do Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
(1 consulta/s no total, cache, sem autocompletar); `GEO_CONTATO` vai no User-Agent.

## API de Cadastros (Sistema)

Listas inteiras (sem paginação) + detalhe com histórico; nada é excluído (`POST /:id/transicao`
com `inativar`/`reativar`).

| Caminho                                 | Campos                                                                   | Regras                                                            |
| --------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `/api/materiais`                        | `nome` (LocalizedText)                                                   | nome único (409 `name_in_use`); 96 iniciais (migration)           |
| `/api/areas`                            | `nome`, `descricao` (LocalizedText, opcional)                            | nome único (409 `name_in_use`)                                    |
| `/api/recipientes?tipo=caixote\|pallet` | `tipo`, `materialId`, `taraKg`, `areaId`, `posicao` (todos obrigatórios) | código `CXT\|PLT-AAAA0001`; material e área ativos; tipo não muda |

## API de histórico de módulo

`GET /api/historico/:modulo?desde=<ISO>` (`ordens` ou `operacao`) — eventos do histórico dos
lotes, mais recente primeiro, cada um com `registroId`, `registroCodigo` (lote) e `clienteNome`.
Ordens: criado, editado, documentos e ocorrências de coleta/trajeto. Operação: criado, recebido,
recebimento_editado, status e ocorrências de recebimento.

## API de Relacionamento (transportadoras, motoristas, veículos)

Os três seguem o mesmo molde: `GET /api/<modulo>` (lista do DataTable), `GET /resumo`,
`GET /:id` (detalhe + histórico + ações), `POST`, `PUT /:id` e `POST /:id/transicao`
(`inativar`, `reativar` — nada é excluído).

| Módulo          | Campos                                                                                                                                          | Regras                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transportadoras | `nome`, `cnpj`, `contatos[]` (opcionais), `motoristas[]` (`{ id }` da lista ou `{ novo: { nome, cpf, telefone } }`)                             | CNPJ único (409 `cnpj_in_use`); se houver contatos, um é o principal; motorista de outra transportadora muda para esta; quem sai da lista fica sem transportadora. `GET /opcoes` |
| Motoristas      | `nome`, `cpf`, `telefone`, `transportadoraId` **ou** `novaTransportadora: { nome, cnpj }` (opcional)                                            | CPF único (409 `cpf_in_use`); a transportadora nova entra em Transportadoras                                                                                                     |
| Veículos        | `tipo` (`truck`, `carreta`, `van`), volume mínimo/máximo (quantidade de volumes), comprimento/largura (m), capacidade em pallets e em toneladas | volume mínimo ≤ máximo; sem placa e sem vínculo com transportadora ou motorista                                                                                                  |

Toda mudança (inclusive vincular/desvincular motorista) vai para o histórico do registro
(tabela `historico`, por entidade).

## API de ordens (agendamento)

| Método e caminho                              | O que faz                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/ordens`                             | lotes (formato do DataTable)                                                                                               |
| `GET /api/ordens/:id`                         | detalhe com quantidades, anexos, cálculo guardado, histórico, etapas, pallets e ocorrências                                |
| `POST /api/ordens/pre-calculo`                | `{ docaId, servicos, quantidades }` → caminhão, capacidade, viagens, pessoas, plataforma, o que levar e avisos (não grava) |
| `POST /api/ordens`                            | cria o lote `LOT-00001` (multipart: `dados` JSON + arquivos `escopo` e `observacoes`, até 20 cada, 25 MB por arquivo)      |
| `GET /api/ordens/:id/anexos/:anexoId/arquivo` | baixa um anexo (sempre como anexo)                                                                                         |
| `PUT /api/ordens/:id`                         | edita o lote — só enquanto `agendado` (409), o cliente não muda (422); refaz o pré-cálculo; histórico com antes → depois   |
| `POST /api/ordens/:id/anexos`                 | adiciona documentos (multipart `tipo` + `arquivos`, até 20; seção `lote`)                                                  |
| `DELETE /api/ordens/:id/anexos/:anexoId`      | remove um documento (histórico); o único escopo sem texto não sai (422 `scope_required`)                                   |

### Detalhe do lote (`server/src/modules/ordens/ordens.lote.ts`)

| Método e caminho                                  | O que faz                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `POST /api/ordens/:id/ocorrencias`                | registra ocorrência (multipart: `dados` = `{ momento, categoria, texto }` + até 10 `fotos`) → lote inteiro        |
| `PATCH /api/ordens/:id/ocorrencias/:oc`           | corrige (mesmos campos + `removerFotos[]`); cancelada não muda (409 `invalid_transition`)                         |
| `POST /api/ordens/:id/ocorrencias/:oc/cancelar`   | cancela (a ocorrência fica, com status `cancelado`)                                                               |
| `GET /api/ordens/:id/ocorrencias/:oc/fotos/:foto` | foto da ocorrência (imagem exibida na tela: `nosniff`, `default-src 'none'`)                                      |
| `GET /api/ordens/:id/pallets/:pallet/foto`        | foto do pallet recebido                                                                                           |
| `POST /api/ordens/:id/recebimento`                | recebe o lote agendado → Inspeção (multipart: `dados` + fotos `lacres.<i>`, `notas.<i>`, `pallets.<i>`, `gerais`) |
| `PUT /api/ordens/:id/recebimento`                 | corrige o recebimento (só em Inspeção); itens com `id` e `fotosManter` mantêm o que já existe                     |
| `GET /api/ordens/:id/recebimento/fotos/:foto`     | foto do recebimento (imagem)                                                                                      |

**Recebimento** (`ordens.recebimento.ts`): data (não futura) e inspeção visual (`bom`, `avaria`,
`outro`) obrigatórias; avaria/outro pedem `inspecaoDescricao` (LocalizedText) e criam/atualizam
uma ocorrência de Recebimento; lacres e notas opcionais, cada um com número e 1–5 fotos; pelo
menos um pallet com `pesoBruto` e 1–5 fotos (`tara` opcional, ≤ bruto; líquido = bruto − tara);
até 20 fotos gerais. Tudo vai para o histórico (`recebido`, `recebimento_editado`).

Momento `coleta`, `trajeto` ou `recebimento`; categorias `atraso`, `avaria_carga`,
`divergencia_quantidade`, `embalagem_inadequada`, `problema_veiculo`, `acesso_negado`,
`material_nao_identificado`, `outro`; texto em 3 idiomas (LocalizedText, traduzido na tela ao
salvar); fotos JPG, PNG ou WEBP até 25 MB. Tudo vai para o histórico do lote (`#n` na referência).
Tipos de documento do lote: `escopo`, `nota_fiscal`, `mtr`, `cdf`, `foto`, `outro`.
Pallets (`ordens_pallets`) e a etapa Inspeção vêm de Operação › Recebimento; as etapas seguintes
(`ordens_etapas`) virão da integração com os sistemas de produção.

Obrigatórios: cliente, site (do cliente), doca (do site), data de coleta e o escopo de trabalho (texto **ou**
arquivo — 422 `scope_required`). Placas de policarbonato só com o serviço IV (Value Recovery –
Racks); quantidade de pallets vazios quando "requer pallets vazios"; motorista e placa só com
rastreio. Datas de coleta/chegada são gravadas como o início do dia em São Paulo.

**Pré-cálculo** (`server/src/modules/ordens/ordens.calculo.ts`, portado do sistema anterior com os
mesmos números): volumes = pallets + gaylords + racks (boxes não contam); o caminhão sai da faixa
de volumes do cadastro de Veículos (só os ativos) e é rebaixado se não couber na doca
(comprimento máximo e espaço); viagens = volumes ÷ capacidade em pallets, para cima; pessoas = 2

- 2 (Onsite Shredding) + 1 (Recycle Only) + 2 a cada 10 racks (Value Recovery); plataforma quando
  a doca não tem dock leveler ou tem tail lift. Sem veículo ativo: 422 `no_vehicles`.

## API do dashboard da operação

`GET /api/dashboard/operacao?mapaDe=AAAA-MM-DD&mapaAte=AAAA-MM-DD` devolve, num só JSON: cards
(chegadas previstas em 7 dias, lotes em processo por etapa, SLA vencido, SLA em risco ≥ 80%,
cumprimento de SLA em 30 dias, COD pendente), previsão de chegada (7 dias, pela data de coleta),
mapa (sites dos clientes com "Microsoft" no nome e as coletas do período), situação por cliente e
lotes em processo com as anomalias de prazo. **SLA** = `slaDias` do cliente (cadastro), contado da
chegada (`recebidoEm`) até o COD. Etapas do lote: `agendado` → `inspecao` → `processo` →
`aguardando_cod` → `concluido` (as quatro últimas virão da integração).

Fundo **Satélite** do mapa: chave da Esri em `VITE_ESRI_API_KEY` (veja `.env.example`); sem ela, só
"Limpo" e "Cinza" (OpenStreetMap).

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
`cnpj_in_use` 409, `invalid_transition` 409, `not_found` 404).

## API de perfis de acesso e auditoria

| Método e caminho                 | O que faz                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/perfis`                | perfis (com quantos usuários usam cada um); `admin` é fixo e vem primeiro          |
| `GET /api/perfis/:id`            | detalhe + histórico (uma mudança por página: `pagina:<página>`) + ações            |
| `POST /api/perfis`               | cria (`nome` e `descricao` LocalizedText, `permissoes` página → `ver`/`editar`)    |
| `PUT /api/perfis/:id`            | edita; o Administrador não muda (409 `fixed_profile`)                              |
| `POST /api/perfis/:id/transicao` | `inativar`/`reativar`; perfil com usuário ativo não inativa (409 `profile_in_use`) |
| `GET /api/auditoria?desde=<ISO>` | todos os históricos do sistema, mais recente primeiro, com `tipo` e registro       |

Páginas aceitas: `server/src/shared/paginas.ts` (as outras são ignoradas). Nome repetido: 409
`name_in_use`. Usuário só recebe perfil ativo (422).

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
