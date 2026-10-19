# Fluxo de trabalho — como construir o iERP do jeito combinado

Complementa o [`CONTEXTO.md`](CONTEXTO.md) (o quê e por quê) com o **como**: o rito de cada pedido,
os comandos, a validação no navegador e as armadilhas já encontradas neste projeto.

## 1. Preparar a máquina (clone novo)

```bash
git clone https://github.com/fcdias0812/iERP.git
cd iERP
npm install                     # frontend (Node >= 22.12; usado Node 24.19 / npm 11.17)
npm --prefix server install     # backend
npx playwright install chromium # só na primeira vez (testes e2e)
npm --prefix server run db:seed # cria server/data/ierp.sqlite com dados FICTÍCIOS
```

- Banco e arquivos enviados ficam em `server/data/` (fora do git). Num clone novo o banco nasce
  vazio + seed; os dados de teste digitados pelo usuário no PC antigo **não** vêm junto.
- Servidores de desenvolvimento (`.claude/launch.json`, use `preview_start` com o nome):
  - **`api`** → `npm --prefix server run dev` (porta **3001**, `tsx watch`; aplica migrations
    pendentes ao subir);
  - **`web`** → Vite na porta **5173** (encaminha `/api` para a 3001). O Vite escuta em `[::1]`
    (IPv6): use `http://localhost:5173`.
- Demonstração sem backend: `VITE_USE_MOCKS=true npm run dev` (API simulada MSW em `src/mocks/`).

## 2. Rito de cada pedido do usuário

1. **Entender e perguntar.** Ler o pedido com a regra do "op" (op = opcional; sem op = obrigatório).
   Levantar tudo que está indefinido e perguntar antes de construir (perguntas objetivas, com opções
   e uma recomendada). Se o pedido citar a v1 (`C:\Systems\TI-Re-Teck-iERP`), ler só a parte citada.
2. **Pesquisar** antes de afirmar fato técnico ou usar API de biblioteca que mudou de versão
   (regra da organização). Pacote novo: versão estável + licença no npm, versão exata.
3. **Backend primeiro** (`server/`): migration nova (`src/db/migrations/AAAA-MM-DD-NN-assunto.ts`,
   registrada em `index.ts`), tipos em `src/db/schema.ts`, módulo em `src/modules/<modulo>/`
   (cadastro simples = um arquivo, como `veiculos/veiculos.ts`; módulo maior = camadas, como
   `clientes/`), rotas em `src/app.ts`, **testes HTTP** (`<modulo>.test.ts`, SQLite em memória).
   Contrato espelhado em `src/services/types.ts`.
4. **Frontend:** chamadas em `src/services/<modulo>.ts`; hooks em `src/features/<modulo>/use-*.ts`
   (cadastro simples: `criarHooksCadastro`); telas com os padrões (`ListPage` + `DataTable`,
   `DetailPage` com abas na URL, cadastro no `CadastroSheet`); rota em `src/routes/_app/...`
   exportando só `Route`; item no menu (`src/config/navigation.ts`); textos nos **3 idiomas**
   (pt-BR, en, zh-TW); erros novos da API em `src/lib/api-errors.ts`; status novo no `statusMap`.
5. **API simulada** (`src/mocks/handlers/`) com o mesmo contrato — os e2e rodam contra ela.
6. **e2e:** spec do módulo em `e2e/` (fluxo principal + regras) e rotas novas em
   `e2e/acessibilidade.spec.ts` (e `responsivo.spec.ts`).
7. **Portão de qualidade** (tudo verde):

   ```bash
   npm run lint && npm run typecheck && npm run test && npm run test:api && npm run check:contrast && npm run check:colors && npm run build
   npm --prefix server run typecheck
   npm run format:check
   npx playwright test            # = npm run test:e2e (gera o build e testa com axe)
   ```

8. **Validar no Chrome com a API real** (§3) — fluxo completo, prints, console sem erros. Apagar os
   dados de teste criados no banco de desenvolvimento (§4).
9. **Documentar:** `README.md` (APIs), `CLAUDE.md` (regras/modelos), `.claude/CONTEXTO.md` (decisões
   do usuário, estado atual, perguntas em aberto) e, se surgir armadilha nova, §5 deste arquivo.
10. **Mostrar ao usuário** (sistema no ar), resumir em linguagem simples e **perguntar se pode
    commitar**. Commit local só com o "sim"; push só se ele pedir.

## 3. Validar no navegador

- **Chrome instalado via Playwright** (o jeito que mais funcionou):
  `node .claude/scripts/validar-no-chrome.mjs` (veja o cabeçalho do script; ele abre as rotas,
  tira prints em `.claude/scripts/prints/` — fora do git — e lista erros do console e respostas HTTP ≥ 400).
  Para fluxos (preencher e salvar), copie o script e escreva os passos com `getByRole`/`getByLabel`.
- O navegador embutido do Claude Desktop (`mcp__Claude_Browser__*`) serve para conferir texto
  (`get_page_text`, `javascript_tool`); a captura falha se o painel estiver escondido.
- **Painel escondido congela as animações** (`document.getAnimations()` fica "running"): popover/
  combobox não some depois de escolher, fica por cima dos campos seguintes e o clique cai nele
  (no AsyncCombobox, clicar de novo na opção DESMARCA). Não é bug do sistema — confirme o fluxo
  com Playwright (`npx playwright test e2e/<spec>`), que renderiza de verdade.
- O **Claude in Chrome** (extensão) **não alcança o localhost** desta máquina — não usar para depurar.
- Bug relatado ("trava", "congela"): reproduzir no Chrome real com o mesmo gesto (ex.: passar o mouse
  no link e clicar — o pré-carregamento do router mudou o comportamento) antes de mexer no código; se
  preciso, pausar com CDP para achar o laço. Criar teste de regressão que falha sem a correção.

## 4. Banco de desenvolvimento (cuidado: tem dados do usuário)

- `server/data/ierp.sqlite` mistura dados fictícios do seed com o que o usuário digitou testando.
  **Não apagar o banco.** Para validar, crie o mínimo (via API) e **remova depois** (via API ou SQL
  pontual), avisando o usuário.
- O seed só preenche tabela vazia (`semear*` por módulo). Ajuste de dado fictício existente → via API
  (fica no histórico), avisando.
- **Migration ainda não commitada precisa mudar?** Pare a API (`preview_stop`), rode
  `npm --prefix server run db:desfazer` (desfaz a última), edite a migration, suba a API de novo (ela
  reaplica). Migration **já commitada** nunca muda — crie outra. Atenção: com a API rodando, o
  `tsx watch` reinicia e **aplica** a migration assim que o arquivo é salvo.
- Ler o banco direto: `node -e` dentro de `server/` com `require('better-sqlite3')` (o pacote só
  existe em `server/node_modules`).

## 5. Armadilhas encontradas no iERP (além das do template)

**Ambiente Windows / Git Bash**

- Heredoc no Git Bash às vezes some com `\\` (vira `\`), quebra com certos textos ("unexpected EOF")
  e estraga UTF-8 em argumentos do `curl`. Para scripts e testes HTTP com acento: grave o arquivo com
  a ferramenta Write e rode (`node arquivo.mjs` / `python -X utf8 arquivo.py`).
- Git Bash converte argumento `/rota` em `C:/Program Files/Git/rota`.
- Python grava CRLF por padrão: `open(..., newline='\n')` e rode o Prettier depois.
- `gh` (GitHub CLI) não está instalado nesta máquina; o push usa o Git Credential Manager.

**Instalação (PC novo)**

- **npm 11.19 tenta compilar o `better-sqlite3` 13** (`node-gyp rebuild`, pede Visual Studio C++)
  mesmo com `"gypfile": false` e o binário pronto do Windows dentro do pacote
  (`prebuilds/win32-x64.node`); o lockfile ganha `"hasInstallScript": true`. Contorno usado em
  19/10/2026: `npm --prefix server install --ignore-scripts` e conferir com
  `node -e "new (require('better-sqlite3'))(':memory:')"` (dentro de `server/`). Não commitar a
  linha `hasInstallScript` que o npm acrescenta ao `server/package-lock.json`.

**Backend**

- Kysely 0.29: `Migrator` vem de `kysely/migration`.
- **SQLite tem UMA conexão:** dentro de `db.transaction().execute(async (trx) => …)`, toda consulta
  tem de usar `trx`. Consultar `db` lá dentro trava a requisição para sempre (nos testes aparece como
  `HeadersTimeoutError` depois de 5 min). Ex.: `conferirVinculos(trx, …)` em `cadastros.ts`.
- **CamelCasePlugin e números:** `itensMais25kg` vira `itens_mais25kg` (não `itens_mais_25kg`) —
  nomeie a coluna como o plugin gera.
- Datas "por dia" (coleta, chegada): gravar como **início do dia em São Paulo** em ISO UTC
  (`inicioDoDia`), senão os filtros por dia do DataTable erram. A API recebe `AAAA-MM-DD`.
- Upload: multer 2 com `memoryStorage`, `defParamCharset: 'utf8'` (nome com acento), 25 MB; arquivo
  em disco pelo id, download sempre `attachment` + `nosniff` (`src/shared/arquivos.ts`). Criação com
  arquivos = **um multipart** (`dados` JSON + campos de arquivo) para ser atômica; se o banco falha,
  apaga o que foi gravado no disco.
- Nominatim: 1 consulta/s, cache, User-Agent com `GEO_CONTATO`, sem autocompletar (política de uso).

**Frontend**

- **DataTable em modo servidor:** página vazia precisa ser constante estável (`EMPTY_PAGE`) e o
  `onExpandedChange` tem guarda — sem isso, laço infinito de render ao abrir a lista vinda de link
  pré-carregado (o bug "Clientes trava"). Em modo cliente: **ordem inicial** obrigatória e lista
  estável (nunca `data ?? []` no render).
- `check:colors` proíbe classe arbitrária com `var(` (ex.: `shadow-[var(--x)]`): use tokens/utilitários.
- `NumberInput` parecia desabilitado porque `read-only:bg-muted` pegava a div: corrigido com
  `read-only:bg-card`.
- i18next: chave montada com variável precisa de cast pontual; passe parâmetros nomeados
  (`{ name, code }`) em vez de objeto dinâmico.
- `navigate({ search: (s) => … })` em rota com `?aba=` tipado dá erro de tipo (o `s` é a união de todas
  as rotas): passe o objeto inteiro (`search: { aba, editar }`).
- `AsyncCombobox` guarda as opções em cache pela `queryKey` (60 s): se a lista de origem chega
  depois, inclua algo que mude (ex.: `dataUpdatedAt`) na chave e faça o `loadOptions` esperar os dados
  — senão fica "Nenhuma opção encontrada" (bug achado no painel de Transportadoras).
- Card que o teste/leitor de tela precisa achar como região: `role="region"` + `aria-labelledby`.
- e2e: localizadores amplos (`main ol > li`) pegam o breadcrumb — dê `aria-label` à lista. Para
  escolher data no `DatePicker`: abrir pelo rótulo e clicar `[data-today] button`.
- axe `target-size` (24 px) reprova coluna estreita com botão — alargue a coluna.
- Rotas novas: rodar o build (`npx vite build`) ou o dev para regenerar `src/routeTree.gen.ts`
  (versionado) antes do `tsc`.
- **Leaflet**: o `className` do elemento onde o mapa é criado não pode mudar depois (o React
  reescreve o `class` e apaga o `leaflet-container` → mapa em branco e travado). Classe que muda
  (ex.: filtro cinza) vai numa moldura por fora (bug achado no mapa do Dashboard).
- **Tirar o NOT NULL de uma coluna**: SQLite e Kysely não fazem de forma portável. Se houver outra
  coluna para trocar de papel, troque os NOMES (`renameColumn`, nos dois bancos) com a view que usa a
  tabela derrubada e recriada em volta (ver migration `2026-10-19-10`); senão, recrie a tabela.
- Antes de registrar uma migration com a API rodando: **pare a API e copie o banco**
  (`db.backup('data/ierp.sqlite.antes-<assunto>')` — o nome cai no `.gitignore`).
- **Janela ao passar o mouse**: `components/ui/hover-card.tsx` (Radix HoverCard; Esc fecha; o
  conteúdo fica fora do teclado/leitor de tela — o gatilho precisa ser um link para as mesmas
  informações). Use `side="bottom"` e `max-h` com `--radix-hover-card-content-available-height`.
- e2e: `loteAgendado` só abre o sistema na primeira vez (recarregar zera a API simulada).

## 6. Commits e GitHub

- Repositório: **https://github.com/fcdias0812/iERP** (branch `main`).
- Mensagem em português: primeira linha com a entrega; corpo com tópicos do que mudou; última linha
  com a coautoria indicada pela sessão (ex.: `Co-Authored-By: Claude … <noreply@anthropic.com>`).
- Commit **só com aprovação** do usuário; **push só quando ele pedir**.
