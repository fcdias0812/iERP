# Integrações — ponto de partida (próxima etapa do iERP v2)

Em 19/10/2026 o usuário disse que o iERP "está pronto para fazer as integrações" e que vai fazê-las
**em outro PC**. Este arquivo junta, para a sessão nova, **o que já existe no código esperando
dado de fora**, onde cada dado entra e o que **ainda precisa ser perguntado** a ele.

> Regra de sempre (CONTEXTO §2): **não decidir pelo usuário.** Nada abaixo foi pedido ainda: são
> os pontos de encaixe que o sistema já tem. Antes de construir cada integração, pergunte os
> itens da seção "Perguntar" (com opções e uma recomendação) e siga o rito do
> [`FLUXO-DE-TRABALHO.md`](FLUXO-DE-TRABALHO.md) §2.

Lembrete do papel do sistema (CONTEXTO §1): o iERP serve mais para **visibilidade e junção de
vários sistemas de produção** do que para operação. Por isso quase tudo no Dashboard, no Progresso
do lote e na Visão geral do cliente aparece zerado ou "aguardando a integração".

---

## 1. O que existe hoje (nada entra de fora ainda)

- **Não há nenhuma rota de entrada para outros sistemas** (sem webhook, sem chave de API, sem
  tarefa agendada que puxe dados). Todas as rotas em `server/src/app.ts` são as da própria tela.
- **Não há login:** o autor do histórico é sempre "Sistema" (`server/src/shared/autor.ts`) e o
  servidor **não confere permissão** — os perfis de acesso valem só nas telas.
- Tudo o que vier de fora precisa passar pela **camada de serviço** do módulo (regras, transação e
  `registrarHistorico`), nunca gravar direto nas tabelas — senão some do Histórico/Auditoria.

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
- **Não existe** função para ir de `inspecao` em diante. A integração precisa de uma (ex.: "mudar
  etapa do lote") no serviço de ordens, usada pela integração e por uma eventual tela.
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

## 4. Antes de começar no outro PC

- Clonar, `/retomar` (instala, sobe `api` e `web`, roda o portão de qualidade).
- O banco do PC antigo **não** vai junto pelo git: o novo começa com o seed fictício (sem cliente
  "Microsoft" — para ver o mapa do Dashboard, cadastrar um cliente com "Microsoft" no nome e sites
  com localização). Para levar os dados de teste, copiar a pasta `server/data/` inteira (com a API
  parada) para o mesmo lugar no PC novo.
- Variáveis do servidor (todas com padrão): `PORT` (3001), `DB_FILE` (`server/data/ierp.sqlite`),
  `ARQUIVOS_DIR` (`server/data/arquivos`), `GEO_CONTATO` (e-mail no User-Agent do Nominatim).
  Frontend: `.env.example` → `.env.local` (`VITE_ESRI_API_KEY`, `VITE_USE_MOCKS`). Chaves de
  integração novas: **nunca** no git.
