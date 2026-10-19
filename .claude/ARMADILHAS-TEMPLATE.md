# Herança do template padrão — decisões e armadilhas

Cópia (19/10/2026) do `.claude/CONTEXTO.md` do template de frontend
(https://github.com/fcdias0812/template-padrao), de onde o iERP nasceu. Fica aqui para que uma sessão
nova não dependa de ter o template na máquina.

> Algumas referências existem **só no template** e não no iERP: página `/design-system`, telas
> `/exemplos/*`, "fábrica de recursos" (`src/config/recursos/`, `src/features/recursos/`), módulo
> Comercial › Pedidos e Cadastros › Categorias. As regras e armadilhas continuam valendo para o
> código do iERP (mesmos componentes, tokens, DataTable, i18n, testes).
>
> Armadilhas **do próprio iERP** estão em [`FLUXO-DE-TRABALHO.md`](FLUXO-DE-TRABALHO.md) §5.

## Decisões de stack (com o motivo)

| Decisão                                                       | Motivo                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 6.0.3**, não 7.x                                 | `typescript-eslint` 8.71 exige TS `<6.1.0`; o TS 7 ainda não tem API programática estável. Reavaliar quando o typescript-eslint suportar TS 7.                                                                                                                                                                                                                                  |
| Vite 8.3.4 + `@vitejs/plugin-react` 6.1.2                     | versões estáveis atuais (out/2026).                                                                                                                                                                                                                                                                                                                                             |
| Tailwind 4.3.3 (`@tailwindcss/vite`)                          | config em CSS (`@theme inline`), sem `tailwind.config`.                                                                                                                                                                                                                                                                                                                         |
| TanStack Table **9.3.1**                                      | é a `latest` no npm. API mudou (`useTable`); exemplos shadcn são v8.                                                                                                                                                                                                                                                                                                            |
| FullCalendar **7.1.2** (`@fullcalendar/react`)                | v7 move plugins para `@fullcalendar/react/daygrid` etc.; `@fullcalendar/core` não é mais peer; exige `temporal-polyfill`. Pacotes padrão são MIT (não usar os premium/scheduler).                                                                                                                                                                                               |
| `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0            | API estável. O novo `@dnd-kit/react` ainda é 0.x.                                                                                                                                                                                                                                                                                                                               |
| MSW **3.0.3** com o plugin `msw/vite` (`mode: 'worker-only'`) | ESM-only, exige TS ≥ 5.9 e Node ≥ 22. O plugin serve o `mockServiceWorker.js` no dev e o emite no build — **não** há arquivo em `public/` (dispensa `msw init`). Imports: `http`/`HttpResponse` de `msw/http`, `delay` de `msw/utils/delay`, `setupWorker` de `msw/browser`, `setupServer` de `msw/node`. Na v3, `onUnhandledRequest` virou `onUnhandledFrame`.                 |
| ExcelJS 4.4.0 + `overrides.uuid = 11.1.1`                     | ExcelJS sem release desde 2024; o override fecha o alerta GHSA-w5hq-g745-h8pq (ExcelJS só usa `v4`). Alternativa SheetJS está congelada no npm.                                                                                                                                                                                                                                 |
| `msw` e `@faker-js/faker` em `dependencies`                   | o build estático é uma demonstração e roda com a API simulada.                                                                                                                                                                                                                                                                                                                  |
| `@axe-core/playwright` (MPL-2.0)                              | só teste, não entra no build.                                                                                                                                                                                                                                                                                                                                                   |
| **Menu lateral próprio** (não o `Sidebar` do shadcn)          | mais simples de controlar com nossos tokens; dispensa os tokens `--sidebar-*`. Estado recolhido em `ui-store.sidebarCollapsed`.                                                                                                                                                                                                                                                 |
| Atalho **Ctrl/⌘+B** recolhe o menu                            | mesmo do shadcn. O Firefox usa Ctrl+B para a barra de favoritos, mas a página intercepta (`preventDefault`). No Chrome o atalho de favoritos é Ctrl+Shift+B.                                                                                                                                                                                                                    |
| Formatos com **`Intl`** nativo (`src/lib/format.ts`)          | `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` resolve o fuso sem pacote extra (`@date-fns/tz` 1.5.0 existe, MIT, mas não foi preciso). date-fns fica para locale do seletor de data (`dateFnsLocale()`).                                                                                                                                                            |
| Rotas: layout `_app` + coringa `_app/$.tsx`                   | todas as telas do menu já navegam ("em construção") sem 60 arquivos de rota; rota específica criada depois tem prioridade. Links da config usam `<AppLink>` (`to="/$"` + `_splat`).                                                                                                                                                                                             |
| **CNPJ alfanumérico** aceito em máscara e validador           | IN RFB 2.229/2024, em produção desde jul/2026: 12 primeiras posições com letras/números, DV = (ASCII − 48) no módulo 11. Teste usa o exemplo da Receita `12.ABC.345/01DE-35`.                                                                                                                                                                                                   |
| `react-day-picker` 10 mantido pelo nome antigo                | a v10 publica também como `@daypicker/react`; o nome antigo continua valendo. Locales vêm de `react-day-picker/locale` (não do date-fns). Componente `Calendar` escrito à mão (o do shadcn é da v9).                                                                                                                                                                            |
| `chart` escrito à mão (sem `shadcn add chart`)                | o CLI fixaria `recharts@3.8.0` (temos 3.10.1) e `next-themes`. Nosso `ChartContainer` vira `config` em `--color-<chave>` no próprio contêiner.                                                                                                                                                                                                                                  |
| FullCalendar 7: tema `classic` + nossas variáveis             | importamos `skeleton.css` + `themes/classic/theme.css` e, no lugar do `palette.css` do pacote, `src/styles/fullcalendar.css` mapeia `--fc-classic-*` para os tokens.                                                                                                                                                                                                            |
| Mensagens do Zod como chave i18n                              | `z.config({ customError })` grava `validation.*` (com parâmetros) e o `FormField` traduz na hora: trocar o idioma traduz os erros já exibidos.                                                                                                                                                                                                                                  |
| DataTable: motor próprio + TanStack Table 9 "manual"          | filtro/ordenação/paginação ficam em funções puras (`engine.ts`), reutilizáveis pelo MSW (fase 6) — garante a mesma semântica no modo cliente e servidor (vazios no fim, desempate por ID, status pelo fluxo, "até" inclusivo no fuso de SP). A TanStack Table 9 (`useTable` + `tableFeatures`) cuida só de colunas (visibilidade, ordem, tamanho, fixação), seleção e expansão. |
| Estado da tabela na URL com Zod (Standard Schema)             | o TanStack Router aceita o schema do Zod 4 direto em `validateSearch`; formato compacto (`s=-total,cliente`, `f={...}`, `a={...}`, `p`, `ps`) e só o que difere do padrão.                                                                                                                                                                                                      |
| Sessão simulada com `status` + guarda em `_app.beforeLoad`    | a demonstração abre autenticada; "Sair" leva a `/login`. O `redirect` só aceita caminho interno (evita redirecionamento aberto). Com o SSO real, a store passa a refletir o servidor.                                                                                                                                                                                           |
| Aviso de alterações não salvas com `useBlocker`               | API atual do TanStack Router: `useBlocker({ shouldBlockFn, enableBeforeUnload, withResolver: true })` + `ConfirmDialog` próprio (proceed/reset).                                                                                                                                                                                                                                |
| API simulada = contrato da API real                           | `src/services/types.ts` é o contrato; telas só falam com `services/` (TanStack Query). O handler da lista usa o `runQuery` do DataTable, então trocar MSW por API real não muda tela. Ações permitidas vêm da API (`acoesPermitidas`) e a tela só confere a permissão do perfil.                                                                                                |
| Banco simulado em memória, semeado                            | faker `pt_BR` com seed fixa (`src/mocks/db.ts`): mesmos dados a cada carga; mudanças valem até recarregar. Datas relativas a hoje (KPIs, "atrasado"). Nos testes, `src/mocks/node.ts` + latência zero.                                                                                                                                                                          |
| **Fábrica de recursos** (`src/config/recursos/`)              | ~46 telas lista + detalhe sem repetir código: a declaração (campos, opções, status, ações, KPIs, rota) serve à API simulada e às telas. A rota coringa `_app/$.tsx` (com `validateSearch: tableSearchSchema`) resolve a declaração pela URL; tela com rota própria tem prioridade. Textos por convenção de chave + teste que confere todas.                                     |
| Valores fechados gravados como **código**                     | status, categoria, prioridade… são códigos traduzidos na tela (`opcoes.*`, `status.*`). Texto digitado pelo usuário (nomes, descrições, comentários) não é traduzido — fica no idioma em que foi escrito.                                                                                                                                                                       |
| e2e no **build** (`vite preview` na porta 4173)               | testa o que vai para produção (com a API simulada ligada). O `webServer` do Playwright gera o build e sobe o preview; localmente reaproveita um servidor já aberto na 4173.                                                                                                                                                                                                     |
| axe com tags `wcag2a`…`wcag22aa`                              | conferido no axe-core 4.14 instalado: a tag `wcag22aa` existe (regra `target-size`); a doc do Playwright só mostra até 2.1.                                                                                                                                                                                                                                                     |
| Alerta `braces` no `npm audit`                                | vem do CLI `shadcn` (dev); sem correção disponível; não vai para o build.                                                                                                                                                                                                                                                                                                       |
| `npm warn install-scripts core-js`                            | scripts de pós-instalação não aprovados de propósito; não são necessários.                                                                                                                                                                                                                                                                                                      |

## Convenções do design system (já implementadas)

- **Tons de estado**: `info` (azul-petróleo) · `success` (verde) · `warning` (amarelo, alerta leve)
  · `alert` (laranja, alerta forte) · `danger` (vermelho) · `inactive` (cinza). Cada um com 5 tokens:
  `--X`, `--X-foreground`, `--X-subtle`, `--X-subtle-foreground`, `--X-border`. Atalhos de classes e
  ícones em `src/lib/status/tones.ts` (`toneStyles`). O `statusMap` (fase 3) usa esses tons.
- Tokens shadcn-compatíveis: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`,
  `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1…8`. Extras: `elevated`,
  `placeholder`, `disabled-foreground`, `border-strong`, `link`, `selected(-foreground)`,
  `*-hover`, `overlay`.
- **Paletas padrão do Tailwind desligadas** (`--color-*: initial` em `src/styles/index.css`): só
  existem classes de tokens. Tamanhos de fonte: `text-12 … text-30` e níveis `type-display`,
  `type-page-title`, `type-section-title`, `type-card-title`, `type-body`, `type-label`,
  `type-caption`, `type-overline`. Números: classe `num`. Alturas por densidade: `h-control`,
  `h-control-sm`, `h-control-lg`, `var(--table-row-h)`.
- `src/lib/utils.ts` estende o **tailwind-merge** com essa escala (`text-12…`, sombras
  `card/popover/modal`, grupo `type-*`). **Ao criar utilitário novo de tamanho/sombra, registre lá**,
  senão o `cn()` remove classes por engano.
- **Temas**: `:root, .light` = claro; `.dark` = escuro. As classes podem ser usadas num trecho da tela
  para forçar um tema (a `/design-system` usa isso).
- **Menu lateral verde-escuro** (pedido do usuário em 16/10/2026, nos dois temas): `class="dark
surface-sidebar"` em `AppSidebar` e na gaveta `MobileNav`. Tokens no fim de `theme.css`
  (`--sidebar-surface` = `brand-green-950`; `.dark .surface-sidebar` escurece com `neutral-950`).
  O `check:contrast` valida os pares do menu como dois temas extras (`SIDEBAR_PAIRS`). Item ativo
  segue azul-petróleo; o verde é só fundo de navegação, não estado.
- Densidade: `data-density="compact"` no `<html>`. Tema/densidade/idioma ficam na store
  `reteck-ui` (localStorage); o script inline do `index.html` aplica antes da primeira pintura.
- **Paleta gerada**: edite `scripts/palette.config.mjs` e rode `npm run tokens`. Nunca edite
  `palette.css`/`palette.json` à mão. Âncoras da logo saem exatas.
- **`check:contrast`** lê os CSS reais e resolve `var()`, `oklch()`, `#hex` e
  `color-mix(in oklab, …)`. Novos pares texto/fundo: siga a convenção `--nome`/`--nome-foreground`
  (checagem automática) ou adicione em `PAIRS` no script.
- Logos: `npm run brand` (sharp + png-to-ico) recorta, gera variação escura (letreiro
  `brand-green-100`, subtítulo `neutral-200`), globo e ícones. O corte globo|letreiro é detectado
  pela maior faixa transparente interna.
- i18n: `pt-BR.json` é a fonte; `en.json` e `zh-TW.json` precisam das mesmas chaves (teste
  `src/i18n/locales.test.ts`). Tipagem das chaves em `src/i18n/i18next.d.ts`.
- Fontes locais: Inter Variable e JetBrains Mono (400/500) sempre; Noto Sans TC (400/500/600) só
  quando o idioma é zh-TW (`loadCjkFont`). Isso deixa o `dist/` com ~19 MB (blocos de fonte CJK por
  `unicode-range`; o navegador só baixa o que usa).

## Armadilhas já encontradas

- **Variável do `@theme` com o mesmo nome da variável CSS** (ex.: `--radius-sm: var(--radius-sm)`)
  gera referência circular. Por isso as sombras dos temas se chamam `--elevation-*` e o `@theme`
  mapeia `--shadow-card: var(--elevation-card)`; raios e easing estão direto no `@theme`.
- **ESLint `react-refresh`**: arquivo de rota deve exportar só `Route`; componentes ficam em arquivos
  separados (ex.: `src/components/layout/RootLayout.tsx`).
- `src/routeTree.gen.ts` é gerado pelo plugin do router mas **fica versionado** — o `npm run build`
  roda `tsc -b` antes do Vite e precisa dele num clone novo.
- `.gitattributes` força LF; Prettier usa LF.
- **Navegador embutido do Claude Desktop**: depois de rolar a página, a captura de tela pode vir em
  branco (o DOM está certo). Contorno: `resize_window` com altura grande (ex.: 1280×6200) e `zoom`
  por região; ou ler com `get_page_text`/`javascript_tool`.
- **CLI do shadcn 4.21.5** (`npx shadcn add`): sem `compilerOptions.paths` no `tsconfig.json` **raiz**
  ele cria uma pasta literal `@/` na raiz e gera `import { cn } from "cn"` + instala um pacote npm
  chamado `cn` (que não tem nada a ver). Corrigido: `paths` no `tsconfig.json` raiz. Mesmo assim,
  **revisar o diff** de todo componente gerado: troque `text-sm`/`text-xs` por `type-*`, `shadow-md`
  por `shadow-popover`, `bg-black/50` por `bg-overlay`, `text-white`/`hover:bg-X/90` por tokens,
  `h-9` por `h-control`, textos fixos ("Close") por `t()`. Os componentes já adaptados ficam em
  `src/components/ui/` (não rode `add --overwrite` neles).
- **i18next**: `_` é separador de contexto/plural — chave chamada `_` (ex.: `nav.comercial._`) quebra a
  tipagem; use `title`. A variável `context` em `t(key, { context })` é reservada (muda a chave);
  use outro nome. Plural (`_one`/`_other`) muda o conjunto de chaves por idioma e quebraria o teste
  de paridade — prefira frases sem concordância ("Telas: 4").
- ESLint `no-irregular-whitespace`: não escreva espaço não separável (U+00A0/U+202F) literal no
  código; o Intl usa esses espaços em moeda/hora (veja `format.test.ts`).
- Radix `ScrollArea` envolve o conteúdo em `display: table`, o que quebra `truncate`; o nosso
  `scroll-area.tsx` força `block`. Para lista com `max-h`, use `overflow-y-auto` simples.
- Navegador embutido: as capturas às vezes pegam animações no meio (menus "transparentes"); confira
  o estado com `javascript_tool` antes de concluir que há bug.
- **Texto `sr-only` dentro de contêiner com rolagem horizontal** (ex.: colunas do kanban): o
  `position: absolute` escapa do `overflow` se nenhum ancestral for `relative` e cria rolagem
  horizontal na PÁGINA. Ponha `relative` no contêiner com rolagem.
- `read_console_messages` do navegador embutido guarda mensagens de antes do recarregamento: depois
  de corrigir um erro, confirme com um `console.error` interceptado ou recarregando e filtrando.
- Componente demonstrado duas vezes (claro/escuro) não pode usar `id` fixo: use `useId()`.
- Botão dentro de botão é inválido: o "limpar" dos campos de data fica ao lado do gatilho.
- `t('chave', { count })` sem chaves `_one/_other` funciona, mas evite `count` com significado de
  plural (o teste de paridade de chaves não aceita plural por idioma).
- **Rota com `autoCodeSplitting`:** o que a rota usa FORA do componente (ex.: `validateSearch`) vai
  para o pacote principal. Importe o mínimo (`@/components/data-table/url-state`), nunca o barril
  `@/components/data-table` — puxou ~400 kB para o carregamento inicial.
- TanStack Table 9: `RowSelectionState` é `Record<string, true>` (não aceita `false`; remova a chave).
  Fixação usa `start`/`end` (não `left`/`right`); `column.getStart('start')` dá o deslocamento.
- Comparar consultas com `JSON.stringify` de objetos montados de jeitos diferentes falha pela ORDEM
  das chaves — normalize (veja `sameQuery` no DataTable).
- Botões soltos dentro de `DropdownMenuContent` não são alcançáveis pelo teclado (o menu só navega
  entre itens): use itens/submenus.
- **Grid sem colunas explícitas estoura no celular**: `grid gap-4 lg:grid-cols-3` usa no celular uma
  coluna implícita do tamanho do conteúdo (ex.: uma faixa com rolagem de 500px). Sempre
  `grid grid-cols-1 …` e, em colunas arbitrárias, `minmax(0,1fr)` em vez de `1fr`.
- Erro em rota filha (ex.: `loader`) usa o `errorComponent` DA rota ou o `defaultErrorComponent` do
  router — o `errorComponent` do layout pai não pega. Por isso o router define os padrões.
- `react-hooks/purity` (React Compiler) reclama de `Date.now()` no render: use
  `useState(() => Date.now())`. E prefira `useWatch` a `form.watch` (o compilador pula componentes
  com `watch`).
- Scripts Python no Windows gravam CRLF por padrão: use `newline='\n'` ou rode o Prettier depois.
- Na emulação de celular do navegador embutido, medir logo após `resize_window` sem recarregar dá
  números misturados (`innerWidth` ≠ layout). Recarregue a página antes de medir.
- **API simulada em dev:** editar arquivo importado pelos mocks dispara HMR e recria o banco em
  memória — um registro criado antes passa a dar 404. Recarregue antes de testar fluxos.
- `fetch` com 200 e corpo não-JSON (ex.: `index.html` do Vite quando o worker ainda não controla a
  página) virava `undefined` e quebrava o TanStack Query ("Query data cannot be undefined"). O
  `api()` agora lança `ApiError('invalid_response')`.
- **cmdk** filtra os itens localmente: resultados que vêm da API precisam de `forceMount` (item e
  grupo). E a seleção fica no primeiro item que existia antes da resposta chegar — controle `value`
  (`commandProps`) para selecionar o primeiro registro.
- KPI com `loading: !dado` fica em esqueleto para sempre se a consulta falhar: use `isPending` e
  mostre "—" no erro.
- `?_erro=500` no endereço da tela é repassado pelo `http.ts` às chamadas (só com mocks ligados) —
  bom para demonstrar estados de erro.
- **`formatDate('2026-10-26')`** (data sem hora) mostrava 25/10: o JS lê como meia-noite UTC, que em
  São Paulo é o dia anterior. Corrigido em `toDate` (lê como meio-dia no fuso da empresa) + teste.
- "Hoje" para comparar datas: use `dayKey(new Date())` (fuso de São Paulo), nunca
  `toISOString().slice(0, 10)` (UTC: depois das 21h já é amanhã). E `dayKey` recebe `Date` ou texto —
  um número (ms) vira data inválida.
- faker `person.fullName()` às vezes põe "Dr.", "Sra."… Use `nomePessoa()` de `src/mocks/recursos/util.ts`.
- Geradores de recursos: `getDb()` e `pools()` rodam ANTES de `faker.seed(hash(id))`, senão a
  sequência de um recurso muda conforme a ordem em que as telas são abertas.
- Chave i18n dinâmica (montada da declaração): o tipo do i18next recusa `string`; os helpers de
  `src/features/recursos/campos.tsx` fazem o cast num lugar só — o teste garante que existem.
- Kanban (dnd-kit): `onChange` dispara várias vezes durante o arraste; grave na API com um pequeno
  atraso depois de soltar (veja `RecursoKanban`). Teclado sintético (`dispatchEvent`) não move
  cartões — o sensor usa a posição real dos elementos.
- Calendário (FullCalendar): sem permissão de edição, não passe `onEventMove` (o componente fica só
  leitura) em vez de desfazer depois de soltar.
- Heredoc no Bash do Windows quebra com certos textos ("unexpected EOF"): grave o script com a
  ferramenta Write e rode o arquivo.
- **e2e reaproveita o servidor da porta 4173** (`reuseExistingServer`). Se um `vite preview` antigo
  ficou aberto (parar a tarefa do `npx` não mata o processo do vite), os testes rodam contra um build
  VELHO. Confira com `Get-NetTCPConnection -LocalPort 4173` e encerre o processo.
- **Rótulo no nome (WCAG 2.5.3)**: `aria-label` que não contém o texto visível é violação. Prefira
  o texto visível + complemento `sr-only`; `aria-label` só onde não há texto (botão só com ícone,
  menu recolhido). No seletor de data, o nome vira "rótulo: texto visível".
- `aria-required`/`required` não valem em `role=button` (gatilho do seletor de data): o
  "* obrigatório" do rótulo já informa.
- FullCalendar 7: `todayText`/`todayHint` vêm do locale ("Hoje" × "Este mês" = violação); o
  `EventCalendar` define os dois pelo i18n. Eventos do mês têm 20 px: `min-height: 1.5rem` no CSS.
- Texto sobre cor de paleta crua (amostras) não passa 4,5:1 em alguns passos médios (ex.: laranja 600) nem com preto nem com branco do neutro: o texto fica abaixo da amostra.
- `page.locator('body').click()` em teste clica no CENTRO da tela — pode cair num card-link e
  navegar. Clique num elemento que não é link (ex.: o `h1`).
- Git Bash converte argumento `/rota` em caminho do Windows (`C:/Program Files/Git/rota`): passe
  rotas sem a barra inicial para scripts.
- `apple-touch-icon.png` está com fundo transparente (como a spec pede). **Não verificado:** como o
  iOS exibe ícone transparente — conferir num iPhone e, se ficar ruim, gerar com fundo.

## Tradução automática do texto do usuário (16/10/2026)

- Pedido do usuário: o que a pessoa digita é traduzido para os 3 idiomas ao salvar; o idioma é
  **detectado do texto** (não do idioma da tela — dá para usar em inglês e escrever em português).
- **MyMemory** (`https://api.mymemory.translated.net/get`): sem cadastro e sem chave; CORS liberado
  (chamada direto do navegador); 5.000 caracteres/dia anônimo, **50.000/dia com e-mail no parâmetro
  `de`** — e-mail do TI `rtbrti03@re-teckbr.com` (padrão em `src/config/traducao.ts`, sobrescrito por
  `VITE_TRANSLATION_EMAIL`). Cota **por IP** (a empresa toda divide). Máx. 500 bytes por chamada
  (`quebrarTexto` divide por frase). Códigos: `pt-BR`, `en-US`, `zh-TW`.
- Testado ao vivo: PT↔EN↔zh-TW funcionam; o PT gerado às vezes sai com vocabulário de Portugal
  ("stock", "encomenda") — por isso as traduções podem ser corrigidas à mão no editor.
- **Privacidade**: não há documentação confirmando se o MyMemory guarda o que é enviado → só em
  campos não sigilosos (regra no `CLAUDE.md`). Outras opções avaliadas: LibreTranslate público pede
  chave; endpoint "grátis" do Google Tradutor não é oficial.
- Detecção **local** (`detectarIdioma` em `src/lib/localized-text.ts`): ideogramas → zh-TW; PT×EN por
  acentos, palavras comuns e terminações. Texto curto/ambíguo usa o idioma da tela como palpite e a
  pessoa pode corrigir ("Escrito em: … (detectado)").
- Formato salvo: `LocalizedText { origem, textos: { 'pt-BR', en, 'zh-TW' }, automaticos }`. Falha de
  rede/cota → salva só o original; a tela mostra o original + "Traduzir agora".
- Onde já está: comentários do pedido (`POST`/`PATCH /api/pedidos/:id/comentarios`) e nome/categoria
  pai em Cadastros › Categorias (`traduzivel: true` no recurso genérico; o handler filtra, busca e
  ordena no idioma da tela). Com a API real, a tradução pode ir para o backend sem mudar as telas.
