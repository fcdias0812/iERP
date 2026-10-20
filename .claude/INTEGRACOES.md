# Integrações com os sistemas de fora

Em 19/10/2026 o usuário disse que o iERP "está pronto para fazer as integrações". Primeiro ia
fazê-las em outro PC; depois decidiu **continuar neste mesmo PC**. Pediu para **separar os sistemas
por cliente, começando pela Dell** — e a primeira integração (Dell → MoonShot) está **pronta**
(§0). O resto deste arquivo é o que ainda espera dado de fora, onde cada dado entra e o que
**perguntar** antes de construir.

> Regra de sempre (CONTEXTO §2): **não decidir pelo usuário.** Antes de cada integração, pergunte
> (com opções e uma recomendação) e siga o rito do [`FLUXO-DE-TRABALHO.md`](FLUXO-DE-TRABALHO.md) §2.
>
> **Regra dele (19/10/2026), vale para TODAS as integrações:** o iERP antigo e o 2.0 vão funcionar
> **JUNTOS** até o 2.0 ficar no lugar por completo. Usando o contrato antigo, **nada** da ligação
> com o antigo muda — só se **acrescenta** o 2.0; com contrato novo, o antigo **não** é excluído.

Lembrete do papel do sistema (CONTEXTO §1): o iERP serve mais para **visibilidade e junção de
vários sistemas de produção** do que para operação.

---

## 0. Dell → MoonShot (pronto, 19/10/2026)

**Fluxo dos lotes da Dell** (palavras dele): 1. criação da ordem no iERP; 2. viagem no iERP (Ordens
› Viagens ainda em construção); 3. recebimento no iERP; 4. operação no MoonShot. "Quando o lote for
recebido no iERP, ele vai ser mandado automaticamente para o MoonShot (vai continuar na aba de
recebidos até alguma ação com ele no MoonShot). Tudo que acontecer lá vira o status
**Processamento x/x**."

- **MoonShot**: `C:\Trabalho\01_Sistemas\BD-Moonshot-Operation-Scan` (.NET 8, SQLite; repositório
  próprio). Já falava com o iERP ANTIGO; a documentação dele (`CLAUDE.md`, seção "Integração com o
  Re-Teck iERP", e `docs/handover/pt-BR/`) descreve o contrato do lado dele. O contrato oficial é o
  `docs/API-INTEGRACAO.md` do iERP antigo (seções 10 e 11) — **não está neste PC**.
- **Decisões dele:** mesmo contrato do antigo ("compensa mais", recomendado); **todos os lotes da
  Dell e só da Dell** (`server/src/modules/integracao/destinos.ts`: nome do cliente com a palavra
  "Dell"); status muda na **1ª ação no MoonShot**; chaves na tela **Administração › Integração**.
- **iERP 2.0** (`server/src/modules/integracao/`):
  - `contrato.rotas.ts` — `/api/integracao/v1` (ping; ordens `?desde=` paginadas `{lotes, temMais,
proximoDesde}`; ordem por código; anexo por número; balanço; devolução POST/DELETE), com
    `X-Api-Key`; respostas `{ success, data }`/`{ success:false, error:{message,code} }`. Cada chave só
    vê os lotes do SEU sistema;
  - `contrato.ts` — a ordem no formato do contrato (id e anexo por NÚMERO; pallets com
    `destino: "MOONSHOT"`; datas em dia; planilha = anexo do escopo `.xlsx`);
  - `sincronizacao.ts` — fila de AVISOS (`POST <urlAvisos> {codigo, evento}`, reenvio com espera
    crescente), leitura do PAINEL do MoonShot a cada 30 s (`GET <urlPainel>` com o token em
    `X-Reteck-Token`/`X-Api-Key`) e a regra do status: recebido → `inspecao` (Recebidos) até a
    `ultimaAtividadeEm` do painel; depois `processo` com a fase ("Processamento 2/4 · Leitura das
    peças"); `Lote encerrado` → `concluido` (`cod_emitido_em` = encerramento: o SLA da Dell termina
    ali). Histórico do lote: `status`, `processamento`, `devolucao_pedida/cancelada` (autor = nome do
    sistema);
  - `integracao.ts` — Administração › Integração (sistema, chave só em hash, avisos, painel, token);
  - recebimento: receber/corrigir lote da Dell enfileira o aviso; com **devolução** pedida pelo
    MoonShot, a correção vale mesmo em processamento e apaga a devolução (ele destrava sozinho);
    documento adicionado/removido num lote JÁ recebido também avisa (`ordem.editada`) — é como a
    planilha da Dell anexada depois chega ao MoonShot. **Sem a planilha `.xlsx` no lote, o
    MoonShot guarda o lote (tela "iERP") mas NÃO cria o lote de trabalho** — regra dele, igual ao
    iERP antigo (lá o escopo em .xlsx era obrigatório);
  - lote de trabalho APAGADO no MoonShot volta na varredura seguinte enquanto o lote existir no
    iERP (regra do MoonShot: todo lote do iERP sem lote de trabalho é refeito da planilha);
  - telas: selo "Processamento i/N" (`features/lotes/StatusDoLote.tsx`), quadro "Processamento no
    MoonShot" na aba Progresso (link "Abrir no MoonShot"), aviso de devolução no detalhe;
    Recebimento › Recebidos = só `inspecao`.
- **MoonShot** (branch `feature/ierp-2-paralelo`, só ACRÉSCIMOS): segunda ligação `IERP2_BASE_URL` /
  `IERP2_API_KEY` (`IerpSettings.FromV2`, `IerpFontes`), aviso em `/api/ierp2/avisos`, coluna
  `IerpLote.Fonte` (`"v2"` = veio do 2.0; migration `AddFonteNoIerpLote`, escrita à mão — não há
  `dotnet ef` neste PC), cursor de varredura próprio (`IerpSyncState` Id 2), e balanço/planilha/
  devolução voltando ao iERP de origem. Sem as IERP2_*, ele é exatamente o de antes. Testes:
  `IerpDoisIerpsTests` (+ os 775 de antes, todos verdes).
- **Configurar em produção:** no iERP 2.0, Administração › Integração › MoonShot: endereço dos
  avisos `http://<MoonShot>/api/ierp2/avisos`, do painel `http://<MoonShot>/api/ierp2/painel` (o antigo segue em `/api/ierp/painel`, só com os lotes dele), o
  MESMO `IERP_PAINEL_TOKEN` do MoonShot, e **Gerar chave**; no `.env` do MoonShot: `IERP2_BASE_URL`
  (endereço do iERP 2.0) e `IERP2_API_KEY` (a chave). O iERP antigo continua com as IERP_* de sempre.
- **Testado de ponta a ponta neste PC (19/10/2026)**: lote LOT-00004 do cliente "Dell (teste da
  integração)" recebido no iERP → aviso (reenviado: o MoonShot estava parado) → MoonShot criou o
  lote de trabalho com as 30 peças da planilha → caixa pesada lá → iERP mostrou "Processamento 1/4 ·
  Pesagem das caixas" e recebeu o balanço.
- **Ainda não:** o MoonShot tem 4 fases hoje (Pesagem das caixas, Leitura das peças, Embalagem e
  bigbags, Lote encerrado — ele falou em "2/6" como exemplo); a viagem (passo 2) depende de
  Ordens › Viagens.
- **Balanço de massa (20/10/2026)**: guardado em `ordens_balancos` (último retrato vence) e mostrado
  na aba **Progresso** do lote, logo abaixo do quadro do processamento (`features/lotes/BalancoDeMassa.tsx`).
  A CONTA é do iERP (`integracao/balanco.ts`, como o MoonShot pede): entrada líquida = bruto −
  embalagem; contabilizado = lido + scrap triado; diferença em kg e % da entrada líquida contra a
  tolerância que ele manda. Situações: aguardando (sem bruto/embalagem), parcial (lote não
  concluído), fechou, fora da tolerância. Tabelas de peso por commodity e bigbags do lote
  (`desteLoteKg` = a parte do lote no bigbag). Lote de teste no banco de dev: **LOT-00006**
  (Dell, concluído, balanço fechando em 1,3%).

## 1. O que existe hoje

- **Rotas de entrada**: o contrato `/api/integracao/v1` (§0), com chave por sistema. Sistema novo
  usa a mesma porta: inclua o cliente→sistema em `destinos.ts` e cadastre-o em Administração ›
  Integração.
- **Não há login:** o autor do histórico é "Sistema" (`server/src/shared/autor.ts`) ou o nome do
  sistema de fora; o servidor **não confere permissão** nas rotas de tela — os perfis valem nas telas.
- Tudo o que vier de fora passa pela **camada de serviço** (regras, transação e
  `registrarHistorico`), nunca grava direto nas tabelas — senão some do Histórico/Auditoria.

## 1.1 Sistemas que já falam com o iERP antigo (baixados em `C:\Trabalho\01_Sistemas`, 20/10/2026)

Levantamento pela palavra "iERP" no código/documentação de cada um — **confirmar com o usuário**
antes de começar qualquer um (e a regra de sempre: o antigo NÃO muda, o 2.0 é acrescentado):

| Sistema | O que é | Ligação com o iERP antigo (pelo que a doc dele diz) |
| --- | --- | --- |
| `OP-Re-Teck-MSDC` (equip-rack-2) | Desmontagem de racks da **Microsoft** | No iERP antigo se chama "Gerenciamento Microsoft"; **cria ordens** (LOT-) lá |
| `VDAS-Gerenciamento-Ericsson` | Coletas **Ericsson, AWS, Google (Dell LATAM), Nokia** | Só as coletas do **Brasil** vão para o iERP |
| `EC-Inventory-Management` | Estoque (lote, pallet, movimentação) | "Campainha" a cada escrita → aba Estoque › Materiais do iERP |
| `EC-ControleNotebooks` | Notebooks (patrimônio e revenda) | Porta de máquina que entrega o estoque ao Estoque do iERP |
| `TI-Triagem-ITAD`, `saas` | — | 1 menção cada (ver antes de afirmar) |

## 2. Pontos de encaixe

### 2.1 Etapas do lote (o mais importante)

- **Onde está:** `ordens.status` = `agendado` → `inspecao` → `processo` → `aguardando_cod` →
  `concluido` (`ETAPAS` em `server/src/modules/ordens/ordens.ts`; tons/ícones no `statusMap` do
  frontend). Datas na mesma linha: `recebido_em` (início do SLA), `etapa_desde` (entrou na etapa
  atual), `cod_emitido_em` (COD = fim do SLA). Linha do tempo: tabela `ordens_etapas` (uma linha por
  etapa, com `em` e `autor`).
- **Hoje:** só o Agendamento cria (`agendado`) e o Recebimento muda para `inspecao`
  (`server/src/modules/ordens/ordens.recebimento.ts` — é o **modelo** de como mudar etapa: atualiza
  `ordens`, insere em `ordens_etapas` e registra no histórico com `acao: 'status'`/`'recebido'`).
- Desde a integração do MoonShot (§0), `aplicarAndamento` (`integracao/sincronizacao.ts`) leva o
  lote de `inspecao` a `processo` e `concluido` pelo painel do sistema de fora — reaproveite para
  os próximos sistemas.
- **O que acende quando chegar:** Dashboard (cards em processo/SLA vencido/em risco/cumprimento/
  COD pendente, situação por cliente, anomalias), aba Progresso do lote, Operação › Lotes (filtro
  por etapa), Histórico de Operação (`acao: 'status'` já entra lá — `server/src/modules/historico/`).
- **Perguntar:** de **qual sistema** vêm as etapas; como o lote é identificado lá (código
  `LOT-00001`? referência do cliente? outro id?); se é o outro sistema que **envia** (rota no iERP)
  ou o iERP que **busca** (de quanto em quanto tempo); se alguém também muda a etapa **na tela**.

### 2.2 Pallets do lote

- **Onde está:** tabela `ordens_pallets` (número, peso, conteúdo, quem pesou, quando, foto) com a
  coluna **`origem`**. Os lançados no Recebimento têm `origem = 'iERP'`; o Recebimento só mexe nos
  dele (`where origem = 'iERP'`) e põe os seus **depois** dos que vieram de fora.
- **Aparece em:** aba Progresso (cards de pallets e peso bruto + tabela pallet a pallet).
- **Perguntar:** qual sistema manda os pallets; se manda foto; se um pallet de fora pode ser
  corrigido no iERP; o que vale quando o mesmo pallet vem dos dois lados.

### 2.3 Clientes › Visão geral (lotes do cliente)

- **Onde está:** `GET /api/clientes/:id/lotes/resumo` (`server/src/modules/clientes/clientes.rotas.ts`)
  devolve **fixo** `conectado: false` e zeros; a tela mostra "sem dados".
- **Atenção:** desde 19/10 o próprio iERP já tem lotes (Ordens). Dá para ligar o resumo às
  `ordens` do cliente **sem** integração nenhuma.
- **Perguntar (pergunta antiga da §6 do CONTEXTO):** quais etapas contam como "a chegar", "em
  operação" e "finalizado"; se o resumo usa os lotes do iERP, os do sistema de produção ou os dois.

### 2.4 Rastreadores GPS e Ordens › Viagens

- **Onde está:** Sistema › Cadastros › Rastreadores GPS é **só tela** (tabela vazia + "Aguardando a
  integração", `src/features/cadastros/AbaRastreadores.tsx`) — **sem tabela nem rota no servidor**.
  Ordens › Viagens ainda está "em construção" (rota coringa). O pedido dele para Viagens: ativas/
  aguardando + finalizadas com **replay no mapa** e as paradas do caminhão (CONTEXTO §5.10).
- **Perguntar:** qual é o sistema/fornecedor de GPS e a API dele (documentação, autenticação,
  limites); quais campos do rastreador aparecem na lista; como a viagem se liga ao lote (um lote,
  várias viagens? — o pré-cálculo já calcula o **número de viagens**); de quanto em quanto tempo
  atualizar a posição. **Pesquisar a API do fornecedor na web antes de afirmar qualquer coisa.**

### 2.5 Dashboard — processos de alto valor

- **Onde está:** cards **Harvesting**, **Refurbish** e **Value Recovery** só com texto
  (`src/features/operacao/DashboardOperacaoPage.tsx`, chaves `operacao.dashboard.altoValor.*`).
  Harvesting espera Operação › Chamados internos; Refurbish e Value Recovery esperam "o sistema de
  ITAD novo" (palavras dele).
- **Perguntar:** qual sistema de ITAD, quais números entram em cada card.

### 2.6 Estoque (Materiais, Assets, Servidores, E-commerce, Peças) e Operação › Chamados internos

- Todos "em construção". **Perguntar** de qual sistema vêm os dados, o que se cadastra no próprio
  iERP e a diferença entre Materiais, Assets, Servidores, E-commerce e Peças.

### 2.7 Login / SSO e permissões no servidor

- **Onde está:** sessão simulada no frontend (`src/stores/session-store.ts`; troca de perfil no menu
  do usuário só para demonstração); `autorDa(req)` devolve "Sistema"; perfis em
  `server/src/modules/perfis/` (permissão = `<página>.<ação>`, `src/config/permissions.ts`).
- A empresa tem skills de SSO com o Portal Re-Teck (`reteck-integracao:*`) — **só aplicar se ele
  pedir**.
- **Quando houver login:** `autorDa` passa a devolver o usuário autenticado; o servidor passa a
  conferir a permissão de cada rota (a mesma regra `can()` do frontend); notificações
  (`GET /api/notificacoes`, hoje lista vazia) e foto do perfil (hoje 501) dependem disso.
- **Perguntar:** qual login (Portal Re-Teck/SSO, Microsoft, outro); se a Auditoria deve registrar
  acessos (entrar/sair).

### 2.8 Outras dependências externas que já existem

- **ViaCEP** (CEP → endereço e região) e **Nominatim/OpenStreetMap** (endereço → coordenadas), pelo
  servidor (`server/src/modules/geo/`; Nominatim com 1 consulta/s, cache e `GEO_CONTATO`).
- **MyMemory** (tradução automática dos textos em 3 idiomas, `src/services/traducao.ts`) — envia o
  texto para um serviço público: nada sigiloso vai traduzido (CLAUDE.md regra 4).
- **Esri** (fundo Satélite do mapa): falta a chave `VITE_ESRI_API_KEY` (o TI criar a conta).
- No menu combinado a partir da v1 havia **Administração › Integração (API)** (CONTEXTO §4) — pode
  ser o lugar para ver/configurar as integrações e chaves. **Perguntar** se ele quer essa tela.

## 3. Sugestão de como começar (para propor a ele, não para fazer direto)

1. Perguntar **qual integração primeiro** (recomendação: as **etapas do lote**, §2.1 — é o que
   mais acende telas: Dashboard, Progresso, Operação › Lotes, Histórico).
2. Para ela, levantar: sistema de origem, identificação do lote, **quem chama quem** (o outro
   sistema envia ao iERP × o iERP busca), formato (JSON/REST?), autenticação, frequência, o que
   fazer com erro/lote não encontrado.
3. Se o iERP **receber** dados: rota própria (ex.: `/api/integracoes/<sistema>/...`) protegida
   (chave por sistema — guardar fora do git, em variável de ambiente), com validação Zod, gravando
   pela camada de serviço, com o **nome do sistema como autor** no histórico.
4. Testes HTTP com SQLite em memória (como os demais) e, se der, um exemplo de chamada no README.

## 4. Antes de começar em outro PC

- Clonar, `/retomar` (instala, sobe `api` e `web`, roda o portão de qualidade).
- O banco do PC antigo **não** vai junto pelo git: o novo começa com o seed fictício (sem cliente
  "Microsoft" — para ver o mapa do Dashboard, cadastrar um cliente com "Microsoft" no nome e sites
  com localização). Para levar os dados de teste, copiar a pasta `server/data/` inteira (com a API
  parada) para o mesmo lugar no PC novo.
- Variáveis do servidor (todas com padrão): `PORT` (3001), `DB_FILE` (`server/data/ierp.sqlite`),
  `ARQUIVOS_DIR` (`server/data/arquivos`), `GEO_CONTATO` (e-mail no User-Agent do Nominatim).
  Frontend: `.env.example` → `.env.local` (`VITE_ESRI_API_KEY`, `VITE_USE_MOCKS`). Chaves de
  integração novas: **nunca** no git.
