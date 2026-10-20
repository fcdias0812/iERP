# CLAUDE.md — Re-Teck iERP (versão 2)

ERP da Re-Teck focado em **logística reversa**. O usuário passa os requisitos aos poucos:
**siga só o que ele disser nesta conversa/projeto** — não puxe regras, telas ou dados do sistema
antigo (v1) nem de outro lugar.

> **Sessão nova? Leia antes de tudo** (ou rode o skill `/retomar`):
> [`.claude/CONTEXTO.md`](.claude/CONTEXTO.md) — ordens do usuário, decisões por módulo, estado
> atual e perguntas em aberto · [`.claude/FLUXO-DE-TRABALHO.md`](.claude/FLUXO-DE-TRABALHO.md) —
> como construir cada pedido, comandos, validação no Chrome, banco de dev, armadilhas do iERP ·
> [`.claude/ARMADILHAS-TEMPLATE.md`](.claude/ARMADILHAS-TEMPLATE.md) — herança do template.
> Repositório: https://github.com/fcdias0812/iERP. Commit só com o "sim" do usuário; push só quando
> ele pedir. Ao terminar uma entrega, atualize o `.claude/CONTEXTO.md`.
> **Próxima etapa: integrações** — leia [`.claude/INTEGRACOES.md`](.claude/INTEGRACOES.md) (onde cada
> dado de outro sistema entra e o que perguntar ao usuário antes).

- **Frontend** (raiz): nasceu do template padrão (https://github.com/fcdias0812/template-padrao,
  na máquina original `C:\Systems\template-padrao`) — design e tecnologias são o padrão da empresa.
  Leia [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md); a página `/design-system` e os exemplos `/exemplos`
  ficam **só no template**. Armadilhas do frontend: [`.claude/ARMADILHAS-TEMPLATE.md`](.claude/ARMADILHAS-TEMPLATE.md).
- **Backend** (`server/`): TypeScript + Node + Express 5. Banco **SQLite** via **Kysely**
  (better-sqlite3), preparado para migrar para **PostgreSQL** (ver "Backend" abaixo).
- Módulos hoje: seção **Relacionamento** — **Clientes** (tudo do cliente fica em **abas** do
  detalhe — contatos, logística, documentos, configurações), **Transportadoras** (detalhe em abas:
  dados, contatos, motoristas, histórico), **Veículos** e **Motoristas** (lista + painel lateral);
  seção **Operação** — **Ordens** (Lotes com detalhe do lote, Agendamento, Histórico; Viagens em
  construção), **Operação** (Dashboard, Lotes — a mesma lista e o mesmo detalhe de Ordens › Lotes
  —, Recebimento e Histórico; Chamados internos em construção) e **Estoque** (em construção); e,
  em Sistema, **Cadastros** (submenu: Materiais, Pallets, Caixotes, Áreas do estoque, Rastreadores GPS)
  e **Administração** (Usuários, Perfis de acesso, Auditoria, Integração).
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
   (não do barril `@/components/data-table`, que puxaria a tabela para o pacote principal). Modelos
   no iERP: `src/features/clientes/ClientesListPage.tsx` (servidor) e
   `src/features/comum/ContatosTabela.tsx` (cliente); detalhes no `DESIGN-SYSTEM.md` §8.
6. **Toda tela segue um padrão de página** (`src/components/patterns/`): `ListPage`, `DetailPage`,
   `FormPage` + `FormSection`, `WizardPage`, `SettingsLayout`, `AuthLayout`/`StatusPage`. Modelos no
   iERP: lista `src/features/clientes/ClientesListPage.tsx`, detalhe com abas
   `src/features/clientes/ClienteDetailPage.tsx`, cadastro no painel
   `src/features/veiculos/VeiculosPage.tsx`, página própria `src/features/ordens/AgendamentoPage.tsx`;
   Perfil e Configurações em `src/features/system/`. Os exemplos Assistente, Dashboard, Relatório,
   Kanban e Calendário estão no template (`src/features/examples/`). Detalhe fora do menu:
   `useBreadcrumb({ parent, label })`.
   **Cadastro e edição SEMPRE no painel lateral à direita** (`CadastroSheet` +
   `CadastroSecao`, `src/features/comum/CadastroSheet.tsx`) — pedido do usuário, um padrão só para
   todos os módulos. Nada de página própria `/novo` ou `/:id/editar` — **única exceção:
   Ordens › Agendamento** (`/ordens/agendamento`, página própria com `FormPage` e o card de
   pré-cálculo ao lado; decisão do usuário). Na lista: `?aberto=novo` ou
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
12. Ações que dependem de perfil passam por `<Can>`/`useCan` — nunca checar o perfil direto na tela.
    Permissão = `<página>.<ação>`: a página é o id do item do menu (`clientes`, `ordens.lotes`,
    `cadastros.caixotes`) e o perfil dá a cada página **Visualizar** (ver/exportar) ou **Editar**
    (tudo); Administrador pode tudo (`src/config/permissions.ts`, Administração › Perfis de acesso).

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
- **Ordens** — `server/src/modules/ordens/`: `ordens.ts` (regras, serviço, rotas; criação em
  multipart com `dados` JSON + arquivos `escopo`/`observacoes`) e `ordens.calculo.ts` (pré-cálculo
  da OS **portado fielmente** de `C:\Systems\TI-Re-Teck-iERP\backend\src\lib\calculoOs.js`, com
  os mesmos testes — mudar número do cálculo é decisão de negócio). Cada ordem é um lote
  `LOT-00001` com status `agendado`. Frontend `src/features/ordens/`. Veículos: volume mín./máx.
  são **quantidade de volumes** (pallets + gaylords + racks; boxes não contam), não m².
- **Lotes** (Ordens › Lotes = Operação › Lotes) — `src/features/lotes/`: a mesma lista e o mesmo
  detalhe nos dois módulos (`origem` = `ordens` | `operacao` decide rota, caminho e permissão
  `<origem>.lotes.ver`/`<origem>.lotes.editar`). Detalhe com abas na URL (`?aba=`): **Informações** (padrão),
  **Progresso** (etapa, pallets, peso bruto, processamento e **balanço de massa** do MoonShot,
linha do tempo, recebimento), **Ocorrências** (painel
  `?ocorrencia=nova|<id>`, texto traduzível, fotos), **Documentos** (do agendamento + adicionados
  depois, com tipo e remoção) e **Histórico**. **Editar** (só enquanto agendado, cliente fixo,
  refaz o pré-cálculo): `LoteSheet` com os campos do Agendamento
  (`features/ordens/agendamento-campos.tsx` + `SecaoContexto` = moldura página/painel); backend
  `PUT /api/ordens/:id`. Backend `server/src/modules/ordens/ordens.lote.ts` (tabelas
  `ordens_etapas`, `ordens_pallets`, `ordens_ocorrencias`, `ordens_ocorrencias_fotos`); fotos
  servidas como imagem (`nosniff` + `default-src 'none'`). Mocks: lote de demonstração `ord00001`.
- **Operação › Recebimento** — `src/features/lotes/RecebimentoPage.tsx` (A receber / Recebidos sobre
  `/api/ordens` com filtro de status) + `RecebimentoSheet` (painel; `?aberto=novo|<id>` na lista,
  `?receber=true` no detalhe) com `CampoFotos` ("Tirar foto" = `capture="environment"`; "Escolher
  arquivo"). Backend `server/src/modules/ordens/ordens.recebimento.ts`: `POST`/`PUT
/api/ordens/:id/recebimento` (multipart `dados` + fotos em `lacres.<i>`, `notas.<i>`,
  `pallets.<i>`, `gerais`), tabelas `ordens_recebimentos`, `ordens_lacres`, `ordens_notas_fiscais`,
  `ordens_recebimento_fotos`; receber = agendado → Inspeção; avaria/outro viram ocorrência.
- **Sistema › Cadastros** — `src/features/cadastros/` (módulo com submenu, uma rota por cadastro
  em `src/routes/_app/cadastros/` — `paginas.tsx`; painel `?aberto=novo|<id>`; listas em modo
  cliente — a API devolve a lista inteira) e
  `server/src/modules/cadastros/cadastros.ts` (`/api/materiais`, `/api/areas`,
  `/api/recipientes?tipo=caixote|pallet`; inativar/reativar; histórico por entidade `material`,
  `area`, `recipiente`). Nome do material e descrição da área em LocalizedText (`RodapeTraduzivel`
  para revisar traduções). Recipiente: código `CXT|PLT-AAAA0001` por tipo e ano.
- **Histórico de módulo** (Ordens › Histórico, Operação › Histórico) —
  `src/features/historico/HistoricoModuloPage.tsx` (a mesma `HistoricoTabela`, com `registro` =
  colunas Lote e Cliente; período 30/90/365 dias ou tudo) e `server/src/modules/historico/historico.ts`
  (`GET /api/historico/:modulo?desde=`; cada módulo filtra as ações e o momento das ocorrências).
  Rótulos do histórico do lote em `features/lotes/historico-lote.ts`. Evento novo de lote (viagens,
  chamados)? Inclua a ação no módulo certo nos dois lados.
- **Operação › Dashboard** — `server/src/modules/dashboard/dashboard.ts` (um endpoint calcula
  tudo: cards de SLA, previsão, mapa, por cliente, anomalias) e `src/features/operacao/` (mapa Leaflet
  carregado sob demanda; config leve em `mapa-config.ts` para não puxar o Leaflet; `CardColeta` =
  card do Forecast com a janela de detalhes — `features/lotes/informacoes-lote.tsx`, a mesma lista
  da aba Informações). Data da coleta = `dataColeta` (confirmada) ou `coletaPrevista` (obrigatória). SLA = `slaDias`
  do cliente; etapas do lote no `status` da ordem (`inspecao`, `processo`, `aguardando_cod`,
  `concluido`).
- **Integração** (Administração) e o contrato com os sistemas de fora — `server/src/modules/integracao/`
  (`contrato.rotas.ts` = `/api/integracao/v1`, o MESMO contrato do iERP antigo; `sincronizacao.ts` =
  avisos + painel → "Processamento i/N"; `destinos.ts` = cliente → sistema, hoje Dell → MOONSHOT) e
  `src/features/admin/integracao/`. O iERP antigo e o 2.0 rodam JUNTOS: integração só por acréscimo.
  Detalhes em `.claude/INTEGRACOES.md` §0. Sistema de ORIGEM (os lotes vêm dele, só para ver aqui):
  Gerenciamento de Projetos — `integracao/gerenciamento.ts` (lê o painel e as ordens de lá a cada
  30 s; espelho ao vivo em `GET /api/ordens/:id/externo`), lote com `externo_sistema` travado por
  `ordens/externo.ts`, telas em `features/lotes/LoteDeFora.tsx` (§0.1).
- **Perfis de acesso e Auditoria** (Administração) — `server/src/modules/perfis/perfis.ts`
  (tabela `perfis_acesso`, permissões página → nível em JSON; `admin` fixo) e
  `server/src/modules/auditoria/auditoria.ts` (junta todos os históricos). Frontend
  `src/features/admin/perfis/` (matriz `MatrizPermissoes`) e `src/features/admin/auditoria/`.
  Páginas: `src/config/paginas.ts` (do menu) = `server/src/shared/paginas.ts` (teste confere).
- **Transportadoras** — detalhe em abas + cadastro no painel (`TransportadoraSheet`) com contatos
  opcionais e motoristas (da lista ou novos). Histórico genérico: tabela `historico` (`server/src/shared/historico.repositorio.ts`).

**Busca global (Ctrl+K)**: registro novo que a pessoa procura pelo código ou nome? Inclua o tipo em
`server/src/modules/sistema/busca.ts` (+ `TipoBusca` em `src/services/types.ts`) e o rótulo, ícone,
permissão e link em `KINDS` (`src/components/layout/CommandPalette.tsx`).

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
   de cada tela é `<modulo>.<tela>.ver` (item direto: `<modulo>.ver`); contador de pendências em
   `badge`. Página nova entra sozinha nos Perfis de acesso — inclua a chave também em
   `server/src/shared/paginas.ts` (o teste `src/config/paginas.test.ts` confere).
3. **Menu**: inclua o id do módulo numa seção do contexto em `CONTEXTS`.
4. **Permissões**: vêm dos Perfis de acesso (nível por página). Ações: `ver`, `criar`, `editar`,
   `excluir`, `aprovar`, `exportar` — Visualizar libera `ver`/`exportar`; Editar libera todas.
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
