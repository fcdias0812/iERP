# Design system — Re-Teck

Este documento explica os tokens, as regras e quando usar cada coisa. A referência navegável
(página **`/design-system`**, nos dois temas) e as telas de exemplo (**`/exemplos`**) ficam no
**template padrão** (`C:\Systems\template-padrao`) — o iERP não carrega essas páginas.

> Fundação (cores, tipografia, forma, densidade, marca) e catálogo de componentes (seção 7).

## 1. Regra das cores (a mais importante)

**A cor segue o significado, não o gosto.** Uma cor, um significado, no sistema inteiro.

| Tom (token)              | Família       | Significado                                        | Exemplos                                     |
| ------------------------ | ------------- | -------------------------------------------------- | -------------------------------------------- |
| `info` / `primary`       | Azul-petróleo | Ação e informação, foco, item ativo, selecionado   | Salvar, Criar, Ver detalhes, Em andamento    |
| `success`                | Verde         | Sucesso / finalizado                               | Concluído, Aprovado, Pago, Entregue, Online  |
| `warning`                | Amarelo       | Alerta leve (espera alguém)                        | Pendente, Aguardando aprovação, Em revisão   |
| `alert`                  | Laranja       | Alerta forte (quase erro)                          | Atrasado, Vencido, Estoque baixo             |
| `danger` / `destructive` | Vermelho      | Erro, exclusão, ação irreversível                  | Excluir, Recusado, Erro, Falhou              |
| `inactive`               | Cinza         | Bloqueado, inativo, cancelado, desabilitado, vazio | Bloqueado, Inativo, Cancelado, Rascunho, "—" |

Regras:

1. **Cor de marca não é cor de estado.** Verde e limão da marca só aparecem no logo, na tela de login,
   em ilustrações de estado vazio, na linha fina de degradê sob a navbar (`bg-brand-gradient`) e
   como **fundo verde-escuro do menu lateral** (`dark surface-sidebar`). Nunca em botão, selo ou aviso.
2. Botão **primário = azul-petróleo**. Secundário = neutro (contorno). Perigoso = vermelho. Verde em
   botão só quando confirma um sucesso ("Aprovar", "Concluir").
3. **Cor nunca é o único sinal**: todo status tem texto **e** ícone (`src/lib/status/tones.ts`).
4. Fundo de aviso = tingimento leve (~10%) com texto e borda no tom forte (`*-subtle`).
5. **Amarelo nunca é texto sobre fundo claro**: o texto usa âmbar escurecido (`warning-subtle-foreground`).
6. Gráficos de categoria usam `chart-1…8` (marca + neutros). Cores de estado só quando o gráfico diz
   bom/atenção/ruim.
7. **Nenhuma cor chumbada**: as paletas padrão do Tailwind estão desligadas (`--color-*: initial`).
   Só existem as classes dos tokens semânticos (`bg-primary`, `text-muted-foreground`, `bg-danger-subtle`…).

### Tokens de estado

Cada tom tem 5 tokens (e as classes Tailwind correspondentes):

| Token                   | Uso                                              | Classe                     |
| ----------------------- | ------------------------------------------------ | -------------------------- |
| `--X`                   | fundo sólido (selo forte, botão)                 | `bg-X`                     |
| `--X-foreground`        | texto sobre o sólido                             | `text-X-foreground`        |
| `--X-subtle`            | fundo tingido (~10%) de avisos e selos           | `bg-X-subtle`              |
| `--X-subtle-foreground` | texto/ícone no tom forte (sobre tingido ou card) | `text-X-subtle-foreground` |
| `--X-border`            | borda no tom forte                               | `border-X-border`          |

Use os atalhos prontos de `toneStyles` (`subtle`, `solid`, `text`, `border`) em vez de montar classes.
O mapa `status de negócio → tom + ícone + rótulo` (`statusMap`) é criado na fase 3 sobre esses tons.

## 2. Tokens

Arquivos em `src/styles/tokens/`:

| Arquivo          | Conteúdo                                                             |
| ---------------- | -------------------------------------------------------------------- |
| `palette.css`    | **gerado** (`npm run tokens`) — escalas OKLCH 50–950 de cada família |
| `palette.json`   | **gerado** — mesmos valores, usados pela página `/design-system`     |
| `theme.css`      | tokens semânticos, temas claro (`:root, .light`) e escuro (`.dark`)  |
| `foundation.css` | tipografia, densidade, layout e movimento                            |

`src/styles/index.css` mapeia os tokens para utilitários do Tailwind (`@theme inline`).

### Paleta (gerada a partir da logo)

`scripts/palette.config.mjs` define as âncoras; os valores da logo saem **exatos** no degrau indicado:

| Token              | Hex       | Na logo                       |
| ------------------ | --------- | ----------------------------- |
| `brand-green-900`  | `#00703C` | letreiro "Re-Teck"            |
| `brand-green-700`  | `#227A48` | fim do degradê do globo       |
| `brand-green-500`  | `#3EB755` | verde médio do globo          |
| `brand-lime-400`   | `#A4CE45` | verde-limão do globo          |
| `brand-lime-300`   | `#D3DE37` | início do degradê do globo    |
| `brand-yellow-200` | `#FDEF6A` | início da órbita              |
| `brand-teal-600`   | `#317D82` | fim da órbita (azul-petróleo) |

Famílias de estado (`success`, `warning`, `alert`, `danger`) e `neutral` (cinza levemente frio) têm
base própria, separada da marca. **Componentes nunca usam a paleta direto** — só os tokens semânticos.

### Tokens semânticos principais

| Grupo       | Tokens                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------- |
| Superfícies | `background` (página) · `card` (card/tabela) · `elevated`/`popover` (sobreposições) · `muted` |
| Texto       | `foreground` · `muted-foreground` · `placeholder` · `disabled-foreground` · `link`            |
| Bordas      | `border` (decorativa) · `border-strong` · `input` (campo, 3:1) · `ring` (foco)                |
| Ação        | `primary` (+`-hover`, `-foreground`) · `secondary` · `accent` (hover) · `destructive`         |
| Seleção     | `selected` + `selected-foreground` (linha selecionada, item ativo do menu)                    |
| Gráficos    | `chart-1` … `chart-8`                                                                         |
| Sombras     | `shadow-card` · `shadow-popover` · `shadow-modal`                                             |

Tema escuro: o primário clareia (`brand-teal-400`) com texto escuro; sombras viram borda + superfície
mais clara. As classes `.light`/`.dark` também podem forçar o tema num trecho da tela.

### Menu lateral verde-escuro (`surface-sidebar`)

O menu lateral (desktop e gaveta do celular) usa `class="dark surface-sidebar"`: `.dark` dá
textos claros e a logo clara; `.surface-sidebar` redefine as superfícies (`card`, `muted`, `accent`,
`border`…) sobre `--sidebar-surface` = `brand-green-950` (no tema escuro, misturado com
`neutral-950` para ficar mais fechado). O item ativo continua **azul-petróleo** (`selected` +
indicador `primary` = `brand-teal-300`). Os pares do menu entram no `check:contrast` como os temas
"menu lateral (claro)" e "menu lateral (escuro)". Popovers, tooltips e menus que abrem a partir do
menu renderizam fora dele (portal) e seguem o tema normal.

### Contraste (WCAG 2.2 AA medido)

`npm run check:contrast` lê os arquivos de token **reais**, resolve `var()`, `oklch()` e
`color-mix()` e mede, nos dois temas: todo par `--X-foreground` × `--X`, texto × superfícies,
selos/avisos, bordas de campo, foco e séries de gráfico. Texto ≥ 4,5:1; componentes ≥ 3:1.
Falha (código 1) se algum par não passar. Ao criar um token novo de texto, siga a convenção
`--nome` / `--nome-foreground` para ele entrar na checagem automaticamente.

## 3. Tipografia

- **Inter Variable** na interface; **JetBrains Mono** para códigos, IDs e seriais (`font-mono`);
  **Noto Sans TC** como fallback do chinês, carregada só quando o idioma é zh-TW.
- Base **14px**. Escala: `text-12` · `text-13` · `text-14` · `text-16` · `text-18` · `text-20` ·
  `text-24` · `text-30`. Pesos: `font-normal` (400) · `font-medium` (500) · `font-semibold` (600).
- **Use os níveis**, não tamanhos soltos:

| Classe               | Tamanho / altura · peso  | Uso                        |
| -------------------- | ------------------------ | -------------------------- |
| `type-display`       | 30 / 36 · 600            | valor de KPI               |
| `type-page-title`    | 24 / 32 · 600            | título da página           |
| `type-section-title` | 18 / 26 · 600            | título de seção            |
| `type-card-title`    | 16 / 24 · 600            | título de card             |
| `type-body`          | 14 / 20 · 400            | corpo                      |
| `type-label`         | 13 / 18 · 500            | rótulo de campo, cabeçalho |
| `type-caption`       | 12 / 16 · 400            | legenda, ajuda, metadado   |
| `type-overline`      | 12 / 16 · 600 maiúsculas | sobretítulo de grupo       |

- Números em tabelas e valores: classe **`num`** (números tabulares + zero cortado). Tabelas já
  aplicam por padrão.

## 4. Forma e profundidade

- Grade de **4px** (espaçamento padrão do Tailwind: `p-1` = 4px, `p-2` = 8px…).
- Raio: `rounded-sm` 4px (campos pequenos, selos) · `rounded-md` 6px (botões, campos) ·
  `rounded-lg` 8px (cards) · `rounded-xl` 12px (modais).
- Borda de 1px em `border` (decorativa); campos usam `border-input` (contraste 3:1).
- Superfícies em 3 níveis: `bg-background` → `bg-card` → `bg-elevated`.
- Sombras: `shadow-card` · `shadow-popover` · `shadow-modal` (no escuro viram borda).
- Movimento: 150–200 ms (`duration-150`/`duration-200`, `ease-standard`); `prefers-reduced-motion`
  zera animações.

## 5. Densidade

`data-density="compact"` no `<html>` (preferência do usuário) troca as variáveis:

| Variável          | Confortável | Compacta |
| ----------------- | ----------- | -------- |
| `--control-h`     | 36px        | 32px     |
| `--control-h-sm`  | 32px        | 28px     |
| `--control-h-lg`  | 40px        | 36px     |
| `--table-row-h`   | 44px        | 36px     |
| `--table-cell-px` | 12px        | 8px      |

Componentes usam `h-control`, `h-control-sm`, `h-control-lg` e `var(--table-row-h)` — nunca altura fixa.

### Layout

| Variável                | Valor          | Uso                                          |
| ----------------------- | -------------- | -------------------------------------------- |
| `--navbar-h`            | 56px           | altura da navbar fixa                        |
| `--sidebar-w`           | 240px          | menu lateral expandido                       |
| `--sidebar-w-collapsed` | 56px           | menu lateral recolhido (só ícones)           |
| `--content-max-w`       | 1600px         | largura máxima da área de conteúdo           |
| `--page-px`             | 16 / 24 / 32px | margem lateral da página (cresce com a tela) |

## 6. Marca

- Navbar, tema claro: logo completa. Tema escuro: variação com letreiro e subtítulo claros
  (globo intacto). Telas estreitas: só o globo. Componente: `<BrandLogo variant="responsive" />`.
- Favicon (`favicon.ico` 16/32/48), `apple-touch-icon.png` (180), `icon-192.png` e `icon-512.png`
  (manifest), recortados do globo com fundo transparente.
- Tudo é gerado por `npm run brand` a partir de `assets/`.

## 7. Componentes

Todos em `src/components/ui/` (importe de `@/components/ui/<arquivo>`), cada um mostrado em todos os
estados e **nos dois temas** na página `/design-system`. Regras gerais: só tokens; altura pela
densidade (`h-control*`); foco visível (contorno global `ring`); textos via `t()`.

### 7.1 Status, ações e rótulos

| Componente                   | Arquivo        | Quando usar                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusBadge`                | `status-badge` | **todo** status de negócio. `status="aprovado"` → tom + ícone + rótulo do `statusMap` (`src/lib/status/statusMap.ts`). `variant="solid"` só para destaque forte; `size="sm"` em tabelas                                                                                                                                                            |
| `Button`                     | `button`       | `default` = ação principal (azul-petróleo, uma por área) · `secondary`/`outline` = neutro · `ghost` = barra de ferramentas · `destructive` = excluir/irreversível · `success` = só Aprovar/Concluir · `link`. Tamanhos `sm`/`default`/`lg`/`icon`/`icon-sm`/`icon-lg`. `loading` mostra spinner + `aria-busy`. Só ícone → `aria-label` obrigatório |
| `ButtonGroup`, `SplitButton` | `button-group` | ações irmãs coladas (Dia/Semana/Mês); botão com a ação comum + menu de variações                                                                                                                                                                                                                                                                   |
| `Badge`                      | `badge`        | contador numérico (neutro; `info`; `solid` no sino; `danger` **só** se o número for de erro). Não use para status                                                                                                                                                                                                                                  |
| `Tag`                        | `tag`          | etiqueta/chip neutro, removível com `onRemove` (filtros ativos, seleção múltipla). Não é status                                                                                                                                                                                                                                                    |

### 7.2 Campos e formulários

| Componente                                        | Arquivo                             | Quando usar                                                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormField`                                       | `form-field`                        | moldura de **todo** campo: rótulo, `*` obrigatório (com texto acessível), ajuda, erro (`aria-describedby`/`aria-invalid`), contador `n/max`. O controle vem pelo render prop: `{(p) => <Input {...p} />}` |
| `FieldSet`                                        | `form-field`                        | grupo com título (checkboxes, radios, seções de formulário)                                                                                                                                               |
| `RhfField`                                        | `form`                              | React Hook Form + Zod + FormField num só componente. Mensagens do Zod já traduzidas (`src/lib/zod-i18n.ts`); regra própria: `.refine(fn, 'validation.cpf')`                                               |
| `Input`, `Textarea`                               | `input`, `textarea`                 | texto livre. `readOnly` = somente leitura (fundo `muted`); `disabled` = bloqueado                                                                                                                         |
| `PasswordInput`, `SearchInput`                    | `input-variants`                    | senha com mostrar/ocultar; busca com lupa, limpar e Esc                                                                                                                                                   |
| `NumberInput`, `CurrencyInput`, `PercentInput`    | `masked-input`                      | números com separadores do idioma; entregam `number` ou `null`. Moeda sempre R$                                                                                                                           |
| `MaskedInput`                                     | `masked-input`                      | `kind`: `cpf`, `cnpj` (aceita o **CNPJ alfanumérico**, em produção desde jul/2026), `cep`, `phone`, `plate` (antiga ou Mercosul). Entrega o valor limpo; valide com `src/lib/validators/br.ts`            |
| `TimeInput`                                       | `masked-input`                      | hora 24h `HH:mm`                                                                                                                                                                                          |
| `DatePicker`, `DateRangePicker`, `DateTimePicker` | `date-picker`                       | data, período de/até (o "até" inclui o dia inteiro ao filtrar) e data + hora. Calendário: `calendar` (react-day-picker 10, idioma e fuso de São Paulo)                                                    |
| `Select`                                          | `select`                            | uma opção numa lista curta (até ~15). Lista longa → `AsyncCombobox`                                                                                                                                       |
| `MultiSelect`                                     | `multi-select`                      | várias opções com busca e chips; `count` mostra a contagem por valor (filtros)                                                                                                                            |
| `AsyncCombobox`                                   | `async-combobox`                    | uma opção buscada no servidor (debounce + cache do TanStack Query)                                                                                                                                        |
| `Checkbox`, `RadioGroup`, `Switch`                | `checkbox`, `radio-group`, `switch` | checkbox (inclusive indeterminado) para escolhas que valem ao salvar; switch para efeito imediato                                                                                                         |
| `FileDropzone`, `AttachmentList`                  | `file-upload`                       | upload por arrastar ou clicar/teclado, com limite de tamanho; lista de anexos com progresso, baixar e remover                                                                                             |

### 7.3 Exibição de dados

| Componente                                                        | Arquivo          | Quando usar                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KeyValueList`                                                    | `metadata`       | detalhes do registro em chave-valor (vazio vira "—")                                                                                                                                                  |
| `AuditInfo`                                                       | `metadata`       | "Criado por … / Alterado por …" com data relativa                                                                                                                                                     |
| `CopyableId`                                                      | `metadata`       | código/ID em fonte mono com botão copiar (+ toast)                                                                                                                                                    |
| `RelativeTime`                                                    | `metadata`       | "há 5 minutos" com a data completa no tooltip                                                                                                                                                         |
| `Card` (+ `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`) | `card`           | superfície padrão; `interactive` para card clicável (envolva num link)                                                                                                                                |
| `KpiCard`                                                         | `kpi-card`       | indicador: valor `type-display num`, variação com seta (verde = bom, laranja = ruim, cinza = estável, conforme `goodWhen`), mini gráfico, `loading`                                                   |
| `Timeline`                                                        | `timeline`       | histórico/auditoria: quem, quando, o quê e antes → depois                                                                                                                                             |
| `Comments`                                                        | `comments`       | comentários com caixa de envio (Ctrl+Enter); `detectLanguage` mostra "Escrito em: <idioma> (detectado)" e entrega o idioma ao `onSubmit` para traduzir                                                |
| `TextoTraduzido`                                                  | `localized-text` | texto do usuário (`LocalizedText`) no idioma da tela; quando é tradução automática mostra o aviso + "Ver original"; sem tradução mostra o original + "Traduzir agora". `compacto` em célula de tabela |
| `SeletorIdiomaTexto`                                              | `localized-text` | abaixo de um campo traduzível: idioma detectado do que a pessoa escreve, com opção de corrigir                                                                                                        |
| `EditorTextoTraduzido`                                            | `localized-text` | diálogo para escrever em qualquer idioma e corrigir as traduções (as corrigidas deixam de ser "automáticas")                                                                                          |
| `Avatar`                                                          | `avatar`         | foto ou iniciais (`initials()` da sessão)                                                                                                                                                             |
| `ChartContainer`, `ChartTooltipContent`, `ChartLegendContent`     | `chart`          | gráficos Recharts 3 (linha, barra, área, pizza/rosca, combinado). Séries de categoria com `var(--chart-1…8)`; cores de estado só quando o gráfico diz bom/ruim. `aria-label` obrigatório              |

### 7.4 Navegação e organização

| Componente      | Arquivo          | Quando usar                                                                                                                |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Tabs`          | `tabs`           | abas do detalhe (Dados, Itens, Anexos, Comentários, Histórico)                                                             |
| `Breadcrumb`    | `breadcrumb`     | caminho da página (o shell gera sozinho: `AppBreadcrumb`)                                                                  |
| `Stepper`       | `stepper`        | etapas do assistente (wizard); etapas concluídas clicáveis para voltar                                                     |
| `Pagination`    | `pagination`     | "1–20 de 348", tamanho da página e navegação                                                                               |
| `Tree`          | `tree`           | hierarquias (categorias, endereçamento, centros de custo) com teclado WAI-ARIA                                             |
| `Kanban`        | `kanban`         | quadro com arrastar e soltar (mouse, toque e teclado, com anúncios para leitor de tela); limite por coluna                 |
| `EventCalendar` | `event-calendar` | agenda mês/semana/dia (FullCalendar 7, MIT). Pesado: carregue com `React.lazy`. Evento com `tone` usa a cor do significado |

### 7.5 Feedback e sobreposições

| Componente                                          | Arquivo                                               | Quando usar                                                                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `toast`                                             | `sonner`                                              | confirmação rápida: `toast.success/info/warning/error` (com ícone do tom). O `<Toaster>` já está no `RootLayout`                            |
| `Alert`                                             | `alert`                                               | aviso inline (`tone` pelo significado; `title`, `action`, `onDismiss`); `variant="banner"` para faixa de página                             |
| `EmptyState`                                        | `empty-state`                                         | lista vazia (ilustração da marca + ação) ou estado secundário com `icon` (sem resultado, sem acesso)                                        |
| `Skeleton`, `Spinner`, `Progress`                   | `skeleton`, `spinner`, `progress`                     | carregando: esqueleto no lugar do conteúdo; spinner em ações curtas; barra com `value` (ou indeterminada) e `tone`                          |
| `Dialog`                                            | `dialog`                                              | modal informativo ou com formulário (prende o foco, Esc fecha)                                                                              |
| `ConfirmDialog`                                     | `confirm-dialog`                                      | confirmação; `variant="destructive"` + `confirmText` exige digitar o nome do item (exclusão irreversível); `variant="success"` para aprovar |
| `Sheet`                                             | `sheet`                                               | gaveta lateral: detalhe rápido, filtros, menu no celular                                                                                    |
| `DropdownMenu`, `ContextMenu`, `Popover`, `Tooltip` | `dropdown-menu`, `context-menu`, `popover`, `tooltip` | menu de ações (⋯), menu do botão direito (sempre com alternativa visível), painel leve, dica curta                                          |
| `Command`                                           | `command`                                             | lista com busca (paleta Ctrl+K, multisseleção)                                                                                              |

### 7.6 Layout (shell)

| Componente          | Onde                              | Quando usar                                                                                   |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `PageHeader`        | `layout/PageHeader`               | topo de **toda** página: título, descrição, selo de status, ações à direita                   |
| `Can`               | `layout/Can`                      | ação por perfil: `fallback="hide"` some; `"disable"` desabilita com tooltip                   |
| `AppLink`           | `layout/AppLink`                  | link para rotas declaradas em `config/navigation.ts`                                          |
| `RequirePermission` | `layout/RequirePermission`        | tela inteira protegida por permissão: sem ela, mostra o 403 dentro do shell                   |
| `RecursoKanban`     | `features/recursos/RecursoKanban` | kanban sobre um recurso declarado: colunas = valores de um campo; soltar grava na API (PATCH) |

### 7.7 Peças de apoio

Usadas pelos componentes acima; em tela, prefira o componente completo.

| Componente    | Arquivo        | Quando usar                                                                                      |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `Label`       | `label`        | rótulo solto de um controle (no formulário, o `FormField`/`RhfField` já põe o rótulo)            |
| `Separator`   | `separator`    | divisão visual entre grupos (menus, barras); `decorative` quando não tem significado             |
| `ScrollArea`  | `scroll-area`  | rolagem com barra discreta em áreas fixas (menu lateral, listas em popover)                      |
| `Collapsible` | `collapsible`  | trecho que abre e fecha (grupos do menu, "mostrar mais")                                         |
| `Kbd`         | `kbd`          | tecla de atalho exibida (Ctrl+K, Ctrl+S) — na busca, no menu e no diálogo de atalhos             |
| `AlertDialog` | `alert-dialog` | base do `ConfirmDialog` (prende o foco, não fecha clicando fora) — use o `ConfirmDialog` em tela |

## 8. DataTable (toda lista)

Componente único em `src/components/data-table/` — **nunca** `<table>` solta em tela de módulo.
Exemplo completo no iERP: `src/features/admin/usuarios/UsuariosListPage.tsx` (DataTable em modo
servidor); no template, `src/features/examples/DataTableExample.tsx`.

```tsx
const columns: DataTableColumn<Pedido>[] = [
  { id: 'code', header: t('…'), type: 'unique-text', accessor: (r) => r.code, mobile: 'title' },
  { id: 'status', header: t('…'), type: 'status', accessor: (r) => r.status },
  { id: 'total', header: t('…'), type: 'currency', accessor: (r) => r.total, total: true },
  { id: 'emissao', header: t('…'), type: 'date', accessor: (r) => r.emissao },
]
const [query, setQuery] = useUrlTableQuery(columns)   // rota: validateSearch: tableSearchSchema
<DataTable id="pedidos" title={t('…')} columns={columns} getRowId={(r) => r.id}
  query={query} onQueryChange={setQuery} data={lista} /* ou page={respostaDoServidor} */ />
```

| Tipo da coluna                                 | Filtro no título                      | Ordenação                | Alinhamento         |
| ---------------------------------------------- | ------------------------------------- | ------------------------ | ------------------- |
| `unique-text` (código, serial, lote, ID, nome) | texto "contém"                        | texto (números naturais) | esquerda            |
| `enum` (categoria, setor, tipo, responsável)   | multisseleção com busca e contagem    | pelo rótulo              | esquerda            |
| `status` (statusMap)                           | multisseleção com contagem            | **ordem do fluxo**       | esquerda            |
| `number`, `currency`                           | faixa "a partir de / até"             | numérica                 | direita (+ `total`) |
| `date`                                         | período de/até (o "até" inclui o dia) | cronológica              | esquerda            |
| `boolean`                                      | todos / sim / não                     | não → sim                | esquerda            |

- **Ordenação:** clique cicla crescente → decrescente → padrão; Shift+clique soma colunas; ▲/▼ e
  `aria-sort`; vazios sempre no fim; desempate pelo ID; aplicada antes de paginar.
- **Filtros avançados** (botão "Filtros"): condições com operadores por tipo e E/OU. Filtros ativos
  viram chips removíveis com "Limpar tudo". Barra com busca geral e **período** (escolhe qual data).
- **Visões salvas** (filtros + ordenação + colunas, com visão padrão por usuário) e **estado na URL**
  (link compartilhável).
- **Colunas:** mostrar/ocultar, reordenar (arrastar ou teclado), redimensionar (arrastar ou setas
  no divisor), fixar à esquerda; cabeçalho e colunas fixas grudam na rolagem.
- **Seleção** com "selecionar todos os N resultados" + `bulkActions`; menu ⋯ por linha (`rowActions`);
  linha expansível (`renderExpanded`); clique/Enter na linha (`onRowClick`); botão Novo + atalho N
  (`onCreate`); rodapé de totais; exportar CSV / Excel / PDF dos resultados filtrados.
- **Estados:** carregando (skeleton), vazio (`empty`), sem resultado (com limpar filtros), erro (com
  tentar de novo).
- **Modo cliente** (`data`) e **modo servidor** (`page` = `{ rows, total, totals, facets? }`) com a
  mesma interface. O motor puro `engine.ts` (`runQuery`) é a regra única — o servidor simulado
  (`src/mocks/handlers/`) usa o mesmo.
- Listas grandes: virtualização automática acima de 100 linhas por página.
- **Celular:** cards (`mobile: 'title' | 'badge' | 'hidden'` nas colunas) com ordenação e filtros em
  controles fora da tabela.

## 9. Padrões de página

Toda tela segue um destes moldes (`src/components/patterns/`); veja cada um funcionando em `/exemplos` do template padrão.

| Padrão                             | Componente                                  | Exemplo                                                                  | Regras                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lista                              | `ListPage`                                  | `/exemplos/lista`                                                        | cabeçalho + KPIs opcionais + `DataTable`; "Novo" na barra da tabela (atalho N); clique/Enter na linha abre o detalhe                                                                                                     |
| Detalhe                            | `DetailPage`                                | `/exemplos/detalhe/:id`                                                  | título, `StatusBadge`, ações (principal por último; verde só para aprovar), metadados (ID copiável, criado/alterado por), alertas, abas Dados · Itens · Anexos · Comentários · Histórico; breadcrumb com `useBreadcrumb` |
| Cadastro/edição                    | `FormPage` + `FormSection`                  | `/exemplos/cadastro`                                                     | seções com título à esquerda; `RhfField` + Zod (valida ao sair do campo e ao enviar); `*` obrigatório; rodapé fixo Cancelar/Salvar; Ctrl+S; aviso de alterações não salvas (navegação e fechar aba)                      |
| Assistente                         | `WizardPage`                                | `/exemplos/assistente`                                                   | `Stepper`; valida cada etapa antes de avançar; etapas feitas reabrem pelo stepper; última etapa = revisão; foco vai para o título da etapa                                                                               |
| Dashboard                          | — (grade de `KpiCard`, gráficos, listas)    | `/exemplos/dashboard`                                                    | filtro de período no cabeçalho; KPIs com comparação; listas de pendências com "Ver todos"                                                                                                                                |
| Relatório                          | —                                           | `/exemplos/relatorio`                                                    | filtros no topo, gráfico, `DataTable` com totais e exportação                                                                                                                                                            |
| Kanban                             | `Kanban`                                    | `/exemplos/kanban`                                                       | filtro no cabeçalho; total por coluna; limite por coluna                                                                                                                                                                 |
| Calendário                         | `EventCalendar` (lazy)                      | `/exemplos/calendario`                                                   | eventos coloridos pelo significado; arrastar remarca; clique abre o detalhe                                                                                                                                              |
| Configurações                      | `SettingsLayout`                            | `/configuracoes`                                                         | seções à esquerda (faixa rolável no celular), formulários à direita                                                                                                                                                      |
| Perfil                             | —                                           | `/perfil`                                                                | dados pessoais, acessos, atividade recente                                                                                                                                                                               |
| Login, acesso pendente, manutenção | `AuthLayout` + `StatusPage`                 | `/login`, `/acesso-pendente`, `/manutencao`                              | fora do shell; logo completa + detalhe do degradê                                                                                                                                                                        |
| 403 / 404 / 500                    | `StatusPage` (`features/system/ErrorPages`) | `/admin/usuarios` como Leitura, `/exemplos/nao-existe`, `/exemplos/erro` | dentro do shell; 500 com "Tentar de novo" e detalhes técnicos                                                                                                                                                            |

### Módulo de referência do iERP: Admin › Usuários

`/admin/usuarios` aplica os padrões Lista, Detalhe e Cadastro com dados da API real (`server/`) —
copie dele ao criar um módulo (`src/features/admin/usuarios/`). Ações do fluxo seguem a regra das
cores (`src/features/admin/usuarios/fluxo.ts`):

| Ação                  | Botão                      | Confirmação                        |
| --------------------- | -------------------------- | ---------------------------------- |
| Desbloquear, Reativar | `default` (azul-petróleo)  | simples                            |
| Bloquear              | `secondary` (é reversível) | diálogo com **motivo obrigatório** |
| Inativar              | `secondary` (é reversível) | simples                            |
| Editar                | `secondary`                | —                                  |

Não há exclusão de usuário: quem sai da empresa é **inativado** (cadastro e histórico ficam).
Quais ações aparecem vem da API (`acoesPermitidas`); a permissão do perfil desabilita o botão
(`<Can fallback="disable">`).

### Checagens automáticas (seções 1–9)

- `npm run check:contrast` — contraste WCAG 2.2 AA de todos os pares de tokens.
- `npm run check:colors` — falha se houver cor fora de token em `src/` (hex, `rgb()`/`oklch()`,
  `bg-[#…]`, paleta padrão do Tailwind, `--brand-teal-600`…). Exceção: `src/styles/tokens/`.
