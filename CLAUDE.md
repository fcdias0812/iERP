# CLAUDE.md — Re-Teck iERP (versão 2)

ERP da Re-Teck focado em **logística reversa**. O usuário passa os requisitos aos poucos:
**siga só o que ele disser nesta conversa/projeto** — não puxe regras, telas ou dados do sistema
antigo (v1) nem de outro lugar.

- **Frontend** (raiz): nasceu do template padrão (`C:\Systems\template-padrao`) — design e
  tecnologias são o padrão da empresa. Leia [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md); a página
  `/design-system` e os exemplos `/exemplos` estão no template. Armadilhas conhecidas do frontend:
  `C:\Systems\template-padrao\.claude\CONTEXTO.md`.
- **Backend** (`server/`): TypeScript + Node + Express 5. Banco **SQLite** via **Kysely**
  (better-sqlite3), preparado para migrar para **PostgreSQL** (ver "Backend" abaixo).
- Módulos hoje: seção **Relacionamento** — **Clientes** (tudo do cliente fica em **abas** do
  detalhe — contatos, logística, documentos, configurações), **Transportadoras** (detalhe em abas:
  dados, contatos, motoristas, histórico), **Veículos** e **Motoristas** (lista + painel lateral) —
  e **Administração › Usuários**.
- Diretoria quer **agilidade**: informação já filtrada onde é usada (histórico/auditoria dentro de
  cada registro, nunca num módulo à parte) e "não está na lista? cadastre aqui mesmo".
- Regra da organização: pesquisar na web antes de afirmar fato técnico (versão, API, menu).
  Pacote novo: confirmar versão estável e licença no npm e fixar versão exata (`save-exact`).

## Regras obrigatórias

1. **Só componentes e tokens do design system.** Nada de cor, tamanho de fonte, raio ou sombra
   inventados. As paletas padrão do Tailwind estão desligadas: `bg-red-500` nem existe.
   Use `bg-primary`, `text-muted-foreground`, `bg-danger-subtle`, `type-page-title`, `rounded-md`…
2. **Regra das cores — a cor segue o significado:**
   - azul-petróleo (`primary`/`info`) = ação e informação;
   - verde (`success`) = sucesso/finalizado;
   - amarelo (`warning`) = alerta leve; laranja (`alert`) = alerta forte;
   - vermelho (`danger`/`destructive`) = erro, exclusão, irreversível;
   - cinza (`inactive`) = bloqueado, inativo, cancelado, sem dado.
   - Cor de marca (verde/limão do logo) **nunca** em botão, selo ou aviso. Exceção de superfície: o
     fundo verde-escuro do menu lateral (`dark surface-sidebar`, ver DESIGN-SYSTEM.md).
   - Botão primário é azul-petróleo; verde só em botão que confirma sucesso (Aprovar, Concluir).
   - Todo status tem **texto + ícone**; todo status sai do `statusMap` (tons em `src/lib/status/tones.ts`).
3. **Paleta crua (`--brand-teal-600`…) só na página `/design-system`.** Telas usam tokens semânticos.
4. **Nenhum texto fixo em componente.** Tudo via `t('chave')`, com a chave nos três arquivos
   (`src/i18n/locales/pt-BR.json`, `en.json`, `zh-TW.json`). O teste `locales.test.ts` falha se faltar chave.
   **Texto digitado pelo usuário** segue três casos:
   - **valor de lista fechada** (status, tipo, UF): guarde o **código** e traduza na tela (`statusMap`,
     `opcoes.*`) — nunca guarde o rótulo;
   - **texto que precisa aparecer nos 3 idiomas e não é sigiloso** (nome de categoria, motivo,
     comentário operacional): `LocalizedText` (`src/lib/localized-text.ts`) — o sistema detecta o
     idioma escrito, traduz para os outros dois ao salvar (MyMemory, `src/services/traducao.ts`) e
     guarda os três. No recurso genérico: `texto('nome', { traduzivel: true })`. Exibir com
     `<TextoTraduzido>`, editar com `<EditorTextoTraduzido>`, comentários com `<Comments detectLanguage>`;
   - **todo o resto fica como foi escrito**: nomes de pessoas e empresas, endereços, documentos,
     códigos, e QUALQUER dado sigiloso (pessoal, financeiro, contrato) — a tradução envia o texto para
     um serviço público na internet.
5. **Toda lista usa o `DataTable`** (`src/components/data-table`). Nunca `<table>` solta em tela de módulo.
   Defina as colunas com o **tipo** certo (`unique-text`, `enum`, `status`, `number`, `currency`, `date`,
   `boolean`) — ele escolhe filtro, ordenação e alinhamento. Estado na URL: `useUrlTableQuery(columns)` e,
   na rota, `validateSearch: tableSearchSchema` importado de `@/components/data-table/url-state`
   (não do barril `@/components/data-table`, que puxaria a tabela para o pacote principal). Modelo:
   `src/features/examples/DataTableExample.tsx`; detalhes no `DESIGN-SYSTEM.md` §8.
6. **Toda tela segue um padrão de página** (`src/components/patterns/`): `ListPage`, `DetailPage`,
   `FormPage` + `FormSection`, `WizardPage`, `SettingsLayout`, `AuthLayout`/`StatusPage`. Exemplos
   prontos para copiar em `src/features/examples/` (menu **Exemplos**, rota `/exemplos`): Lista,
   Detalhe, Cadastro, Assistente, Dashboard, Relatório, Kanban, Calendário; Perfil e Configurações em
   `src/features/system/`. Detalhe fora do menu: `useBreadcrumb({ parent, label })`.
   **Cadastro e edição SEMPRE no painel lateral à direita** (`CadastroSheet` +
   `CadastroSecao`, `src/features/comum/CadastroSheet.tsx`) — pedido do usuário, um padrão só para
   todos os módulos. Nada de página própria `/novo` ou `/:id/editar`. Na lista: `?aberto=novo` ou
   `?aberto=<id>`; no detalhe: `?editar=true`. O painel já traz Ctrl+S, aviso de campo obrigatório
   e confirmação ao fechar com alterações. Registro com página de detalhe: depois de criar, abre o
   detalhe. (`FormPage` fica só para formulários que não são cadastro, ex.: configurações.)
   Grid responsivo começa com `grid-cols-1` (sem isso o grid estoura no celular).
7. **Dados só pela camada `services/`** (API real em `server/`; MSW só com `VITE_USE_MOCKS=true`).
   Tela nunca importa mock direto.
8. **Acessibilidade WCAG 2.2 AA**: foco visível, navegação por teclado, `aria` correto, contraste.
   Mexeu em token de cor? Rode `npm run check:contrast`.
9. Números e valores com a classe `num`; códigos/IDs/seriais com `font-mono`.
10. Alturas de controles por densidade: `h-control`, `h-control-sm`, `h-control-lg`, `var(--table-row-h)`.
11. Datas, moeda, números e porcentagens **só** por `src/lib/format.ts` (idioma atual + fuso
    `America/Sao_Paulo`). Valor vazio = `—` (`EMPTY`).
12. Ações que dependem de perfil passam por `<Can>`/`useCan` — nunca checar o papel direto na tela.

## Antes de entregar

```bash
npm run lint && npm run typecheck && npm run test && npm run test:api && npm run check:contrast && npm run check:colors && npm run build
```

Backend: também `npm --prefix server run typecheck`.

Mexeu em tela? Rode também `npm run test:e2e` (acessibilidade WCAG 2.2 AA com axe, teclado,
responsivo) e inclua a rota nova em `e2e/acessibilidade.spec.ts`. Erros comuns que o axe acusa:
botão com `aria-label` diferente do texto visível (o nome precisa CONTER o texto — use `sr-only`
para complementar), `aria-required` em botão, texto sobre cor de paleta crua, alvo clicável menor
que 24 px.

## Nome do sistema

`app.name` = **iERP** (3 idiomas), `<title>` do `index.html` e `name` do
`public/manifest.webmanifest` = "Re-Teck · iERP".

## Backend (`server/`)

Camadas por módulo em `server/src/modules/<modulo>/`:

| Arquivo                   | Papel                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| `<modulo>.types.ts`       | contrato da API — **espelho** de `src/services/types.ts` (mude os dois) |
| `<modulo>.regras.ts`      | esquemas Zod, fluxo de status, colunas da lista (`ColunaConsulta[]`)    |
| `<modulo>.repositorio.ts` | só acesso ao banco (Kysely)                                             |
| `<modulo>.servico.ts`     | regras de negócio, transações, histórico                                |
| `<modulo>.rotas.ts`       | rotas Express (montadas em `src/app.ts`)                                |
| `<modulo>.test.ts`        | testes HTTP com SQLite em memória (`node:test`)                         |

Regras:

- **Portável para PostgreSQL**: nada de SQL específico do SQLite. Use o construtor do Kysely;
  SQL cru (`sql` do Kysely) só com funções comuns aos dois (`lower`, `count`, `max`, `case`). Datas em texto ISO
  UTC, sim/não 0/1, JSON em texto, ids UUID em texto. Trocar de banco = trocar o dialeto em
  `src/db/database.ts`.
- **Migrations** (`src/db/migrations/`): arquivo `AAAA-MM-DD-NN-assunto.ts` com `up`/`down`,
  registrado em `migrations/index.ts`. Nunca altere uma migration já aplicada — crie outra.
  Nomes no banco em snake_case; no código em camelCase (CamelCasePlugin). Tipos das tabelas em
  `src/db/schema.ts`. O servidor aplica as pendentes ao subir.
- **Listas**: o DataTable manda `q, s, f, a, p, ps`; use `lerConsulta` + `whereDaConsulta` +
  `ordemDaConsulta` (`src/shared/consulta-tabela.ts`) — mesma semântica do motor do frontend
  (datas por dia no fuso de SP, vazios no fim, status pela ordem do fluxo). Busca geral usa uma
  coluna `busca` (texto normalizado, sem acento).
- **Erros**: lance `ErroApi(status, code, message)`; Zod vira 422 `validation`. O frontend traduz
  os códigos em `src/lib/api-errors.ts`.
- **Autor do histórico**: `autorDa(req)` (`src/shared/autor.ts`) — provisório ("Sistema") até o
  login ser definido.
- `npm --prefix server run db:seed` cria dados **fictícios** só para desenvolvimento.

## Como adicionar um módulo

O layout não muda. Modelos completos para copiar:

- **Clientes** — item direto no menu (sem submenu); detalhe com abas na URL (`?aba=`), uma por
  arquivo em `src/features/clientes/detalhe/` (Visão geral, Contatos, Logística com painel lateral
  - mapa Leaflet carregado sob demanda, Documentos com envio de arquivo, Histórico como tabela de
    auditoria); cadastro no painel (`ClienteSheet`) com lista de contatos (`useFieldArray`). Rotas `src/routes/_app/clientes/`,
    backend `server/src/modules/clientes/` (view `clientes_lista`; sites/docas, documentos em disco)
    e `server/src/modules/geo/` (CEP e endereço → coordenadas).
- **Administração › Usuários** — módulo com submenu. Frontend `src/features/admin/usuarios/`
  (cadastro em `UsuarioSheet`), rotas `src/routes/_app/admin/usuarios/`, backend
  `server/src/modules/usuarios/`.
- **Cadastro simples** (Veículos, Motoristas) — só lista; o painel lateral (`CadastroSheet`) tem
  abas Dados/Histórico e Inativar/Reativar, aberto por `?aberto=<id|novo>` na URL. Backend num arquivo só
  (`server/src/modules/veiculos/veiculos.ts`); hooks por `criarHooksCadastro` (`features/comum/use-cadastro.ts`).
- **Transportadoras** — detalhe em abas + cadastro no painel (`TransportadoraSheet`) com contatos
  opcionais e motoristas (da lista ou novos). Histórico genérico: tabela `historico` (`server/src/shared/historico.repositorio.ts`).

Peças compartilhadas em `src/features/comum/`: `ContatosEditor`/`ContatosTabela` (principal em
primeiro e destacado), `HistoricoTabela` (auditoria em tabela), `CadastroSheet`, `basicos.ts`
(inclusão rápida de motorista/transportadora). Inativar em vez de excluir.

Coisas que pertencem a um registro (contatos, locais, documentos do cliente) viram **abas** do
detalhe dele, não itens de menu. Pedido da diretoria: **agilidade** — a informação aparece já
filtrada onde a pessoa está (auditoria/histórico dentro do registro e de cada módulo), cadastro de
itens do registro em painel lateral sem sair da aba, e nada de "ir a outro módulo e filtrar".

Tabelas: `DataTable` em modo cliente precisa de **ordem inicial** (`sort`) — sem ela, desempata
pelo id interno e a ordem parece aleatória — e de **lista estável** (constante para vazio, nunca
`data ?? []` no render). `pinTop`/`highlightRow` fixam e destacam linhas (ex.: contato principal).

1. **Rótulos**: crie as chaves `nav.<modulo>.title` e `nav.<modulo>.<tela>` nos 3 arquivos de idioma.
   Não use `_` como nome de chave nem `context`/`count` como nome de variável: são reservados do i18next.
2. **Declaração**: em `src/config/navigation.ts`, adicione o módulo em `MODULES` (ícone do
   lucide-react, `labelKey`, `children` com `leaf(modulo, id, labelKey, rota)`). A permissão padrão
   de cada tela é `<modulo>.ver`; contador de pendências em `badge`.
3. **Menu**: inclua o id do módulo numa seção do contexto em `CONTEXTS`.
4. **Permissões**: ajuste a matriz `ROLE_PERMISSIONS` em `src/config/permissions.ts` se o módulo
   precisar de regra diferente (ações: `ver`, `criar`, `editar`, `excluir`, `aprovar`, `exportar`).
5. **Backend**: migration + tipos em `server/src/db/schema.ts` + módulo em
   `server/src/modules/<modulo>/` (ver "Backend") + rotas em `server/src/app.ts` + testes.
6. **Contrato e chamadas**: tipos em `src/services/types.ts`, chamadas em `src/services/<modulo>.ts`
   (com as chaves de query); consultas e mutações (invalidação + toast + `apiErrorMessage`) num
   `use-<modulo>.ts` da feature. Opcional: handler simulado em `src/mocks/handlers/` (para os e2e e
   demonstração sem backend).
7. **Telas**: até existir a rota, a tela abre "em construção" (rota coringa `src/routes/_app/$.tsx`).
   Crie `src/routes/_app/<caminho>.tsx` exportando só `Route`, com o componente em
   `src/features/<modulo>/`. Siga um padrão de página (`ListPage`, `DetailPage`, `WizardPage`…);
   cadastro/edição no `CadastroSheet`. Tela fora do menu (detalhe) chama `useBreadcrumb({ parent, label })`;
   tela inteira protegida por `<RequirePermission>`. Inclua as rotas novas nos e2e (`e2e/`).
8. **Ações por perfil**: `<Can permission="<modulo>.criar" fallback="disable">…</Can>` (ou `hide`);
   em lógica, `useCan('<modulo>.excluir')`.
9. **Links**: para rotas da configuração use `<AppLink to="/caminho">`; para rotas tipadas, o
   `<Link>` do TanStack Router.

## Como adicionar um contexto (cliente/unidade/empresa)

Em `src/config/navigation.ts`, adicione um item em `CONTEXTS` com `id`, `name` (razão social —
é dado, não passa pelo i18n), `document` (CNPJ), `kind` (`cliente` | `unidade` | `empresa`) e as
`sections` com os módulos daquele contexto. Trocar de contexto troca o menu e volta ao Início. Com
um contexto só, o seletor do canto inferior esquerdo não aparece.

## Mapa do código

| Pasta                        | Para quê                                               |
| ---------------------------- | ------------------------------------------------------ |
| `src/styles/tokens/`         | paleta (gerada), tokens semânticos, fundação           |
| `src/components/ui/`         | design system (componentes base shadcn/ui adaptados)   |
| `src/components/layout/`     | shell: navbar, menu, busca Ctrl+K, PageHeader, `<Can>` |
| `src/components/data-table/` | DataTable único                                        |
| `src/features/<modulo>/`     | telas dos módulos                                      |
| `src/config/`                | navegação, contexto, permissões                        |
| `src/services/`              | chamadas REST + contrato (`types.ts`)                  |
| `src/mocks/`                 | API simulada (MSW 3), opcional: `VITE_USE_MOCKS=true`  |
| `server/src/`                | backend: app Express, banco (Kysely), módulos          |
| `src/i18n/`                  | traduções                                              |
| `src/stores/`                | Zustand (preferências, sessão, shell, breadcrumb)      |
| `src/hooks/`                 | `useCan`, `useCurrentContext`, `useHotkey`             |
| `src/lib/format.ts`          | datas, moeda, números (idioma + fuso São Paulo)        |
| `scripts/`                   | `tokens`, `brand`, `check:contrast`                    |

## Geradores

- `npm run tokens` — muda a paleta? Edite `scripts/palette.config.mjs` e rode. Nunca edite
  `palette.css` à mão.
- `npm run brand` — logos e favicons a partir de `assets/`.
