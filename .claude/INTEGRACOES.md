# Integrações com os sistemas de fora

Em 19/10/2026 o usuário disse que o iERP "está pronto para fazer as integrações". Primeiro ia
fazê-las em outro PC; depois decidiu **continuar neste mesmo PC**. Pediu para **separar os sistemas
por cliente, começando pela Dell** — a primeira integração (Dell → MoonShot) está **pronta** (§0) e a
segunda (Gerenciamento de Projetos → iERP, só para ver) também (§0.1). O resto deste arquivo é o que
ainda espera dado de fora, onde cada dado entra e o que **perguntar** antes de construir.

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
  Dell e só da Dell** (até 22/10/2026 pelo nome do cliente com a palavra "Dell"; desde então pela
  aba **Configurações do cliente › Sistema de processamento** — `clientes.sistema_processamento`;
  a migration `2026-10-22-01` levou os clientes "Dell" para o MoonShot e cliente novo com "Dell" no
  nome já nasce assim; `destinos.ts` só lista os sistemas); status muda na **1ª ação no
  MoonShot**; chaves na tela **Administração › Integração**.
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

## 0.1 Gerenciamento de Projetos → iERP (pronto, 20/10/2026)

Sistema `C:\Trabalho\01_Sistemas\VDAS-Gerenciamento-Ericsson` ("pode colocar como Gerenciamento de
Projetos"; Node + Express + `node:sqlite`, porta 5005). Palavras dele: "quem vai controlar tudo é o
Gerenciamento de Projetos. Ele vai criar a ordem (não tem processamento nenhum), e quando chegar o
lote na empresa, eles vão fazer o recebimento e o Gerenciamento de Projetos vai fazer o COD. **O iERP
vai servir aqui apenas para visualização.**"

- **Como ele fala com o iERP ANTIGO** (`INTEGRACAO.md` dele): EMPURRA cada ordem nova/alterada
  (webhook para `…/api/integracao/v1/ordens` do antigo, que cria o lote e devolve o código —
  guardado em `collections.reteck_lote`); e o antigo LÊ `GET /api/integracao/painel` (etapa, datas,
  COD) e `GET /api/integracao/ordens/:id/completa` (o "espelho": pesagens com foto, documentos,
  materiais, notas). Token `INTEGRACAO_TOKEN` (cabeçalho `X-Reteck-Token`/`X-Api-Key`). Só Brasil.
- **Como o 2.0 faz (nada muda no Gerenciamento nem no antigo):** o 2.0 só **LÊ**, com o mesmo token,
  as rotas que já existem — a cada 30 s o painel + `GET /api/integracao/ordens?desde=<ontem>` (e
  `/ordens/:id`, ou a lista inteira na 1ª carga); o espelho só ao abrir o lote. Código:
  `server/src/modules/integracao/gerenciamento.ts` (ligado em `lerPaineis`, `sincronizacao.ts`).
- **Decisões dele:** todos os clientes (Ericsson, AWS, Google, Nokia), **só Brasil**, e **TODAS as
  coletas** já na 1ª leitura — inclusive concluídas e canceladas, "como o iERP antigo" (a cancelada
  vira lote Cancelado; sem o dia do cancelamento lá, a tela não inventa data); recebimento e
  COD **lá** — no iERP o lote é **só para ver** (sem Editar, Receber, ocorrência nem documento:
  `ordens/externo.ts` recusa com 409 `external_lot`); etapas **espelham** as de lá (antes →
  agendado, inspecao → inspeção, processo, aguardandoCod, encerrado → concluído no COD, cancelado →
  **cancelado** — status novo do lote, fora da linha do tempo); o **cliente é o cadastrado no iERP**
  (com CNPJ), achado pelo nome (ericsson / aws|amazon / google / nokia — `PADROES` em
  `gerenciamento.ts`); sem cliente (ou com mais de um), a coleta **espera** e Administração ›
  Integração avisa; **site e doca** que faltarem são **criados sozinhos** nesse cliente (doca
  "Principal" com 4,40 m — limite legal, Resolução CONTRAN 210/2006 —, para ajustar no cadastro).
- **No lote:** `ordens.externo_sistema/externo_id/externo_dados` (migration
  `2026-10-20-01-lotes-de-fora`; view `ordens_lista` com `origem` = IERP | sistema); referência do
  cliente = número da ordem lá; `recebido_em` = chegada lá (início do SLA), `cod_emitido_em` = COD
  (encerrada sem COD fica fora do SLA). Telas: aviso "Lote do Gerenciamento de Projetos" com link,
  aba Informações › "Ordem no Gerenciamento", Progresso › "Recebimento no Gerenciamento" (pesagens
  com foto, materiais, notas; os cartões de pallets/peso usam o pesado lá) e Documentos lá
  (`features/lotes/LoteDeFora.tsx`, espelho por `GET /api/ordens/:id/externo`). Recebimento ›
  A receber/Recebidos mostra só `origem = IERP`. O contrato do MoonShot ignora lotes de fora
  (`sistemaDoLote`): "Google (Dell LATAM)" não vai para o MoonShot.
- **Administração › Integração:** sistema de tipo **origem** (`SISTEMAS_CONHECIDOS` em
  `destinos.ts`): só endereço do painel (`http://<Gerenciamento>:5005/api/integracao/painel`) e o
  token (qualquer tamanho); seção Sincronização com coletas lidas, ligadas e as pendências de cliente.
- **Testado neste PC (20/10/2026)** com o Gerenciamento de TESTE (`.claude/scripts/subir-gerenciamento.cmd`,
  servidor `gerenciamento` do launch.json: banco `data\coletas-ierp2-teste.db` de lá, envio ao antigo
  DESLIGADO; usuário de teste na linha `rem` do `gerenciamento.env.cmd`, fora do git): 4 coletas
  fictícias → LOT-00007 (Ericsson, processo 6/8), LOT-00008 (Ericsson, concluído no COD), LOT-00009
  (AWS, agendado, site GRU60 e doca criados) e a da Nokia esperando o cadastro.
- **Robustez (revisão de 20/10/2026, com testes em `gerenciamento.test.ts`):** erro numa coleta não
  trava as outras (fica em "falhas" na Integração e tenta de novo na leitura seguinte); erro nas
  listas de ordens não trava a mudança de etapa dos lotes; fase desconhecida lá não mexe no lote;
  datas do SLA nunca são inventadas nem andam sozinhas; Concluído = dia do COD (o painel de lá, no
  COD, ainda diz "Processando" com o dia do início — achado no teste real); etapas puladas entre
  leituras entram com o dia de lá; coleta restaurada da Lixeira (id novo, mesmo número) religa o
  lote; coleta que some do painel deixa o lote como está e aparece em "sumidos"; a lista inteira
  de ordens é relida de 6 em 6 h; o site é comparado com o de lá (renomear aqui não duplica);
  cliente só inativo aparece como "inativo"; Gerenciamento e MoonShot são lidos em paralelo.
- **Cuidado:** as fotos do espelho são links do Gerenciamento (ele monta com o IP da rede); com o iERP
  em HTTPS e o Gerenciamento em HTTP o navegador bloquearia — aí, servir as fotos pelo servidor do iERP.

## 0.2 Re-Teck MSDC (equip-rack, Microsoft) → iERP (pronto, 20/10/2026)

Sistema `C:\Trabalho\01_Sistemas\OP-Re-Teck-MSDC` (equip-rack-2, renomeado Re-Teck MSDC; Node +
Express + Prisma/SQLite, porta 5013 em **HTTPS** com a CA Re-Teck). Palavras dele: "vai seguir o
mesmo esquema do gerenciamento de projetos, vai ser criado o lote lá e todo o processo é feito lá."

- **Decisões dele:** rota NOVA no MSDC só de leitura para o agendamento (o painel de lá não traz
  site/doca/transportadora/datas/quantidades) — "Rota nova no MSDC"; **todos** os lotes (os
  nascidos lá e os que chegaram pela doca do iERP antigo; lote de TESTE de lá nunca); nome
  **"Re-Teck MSDC (Microsoft)"**.
- **No MSDC** (só acréscimo, branch `feature/leitura-para-o-ierp-2`): `GET /api/integracao/ordens`
  e `/ordens/:id` — o MESMO corpo que a fila manda ao iERP antigo (`ordemParaEnvio`), sem `fases`,
  com `url` e `atualizado_em`; mesma guarda `INTEGRACAO_TOKEN` (INTEGRACAO.md §8 de lá).
- **No iERP:** o motor do Gerenciamento ganhou ADAPTADORES por sistema (`gerenciamento.ts`:
  `ADAPTADOR_MSDC`) — painel `lotes` (a carga ainda não contada, `aguardandoLote`/"chegada:…",
  fica de fora; pedido com `?diasDePecas=1`), cliente fixo "Microsoft" (o cliente do iERP com
  "Microsoft" no nome), doca pelo NÚMERO do agendamento (criada no site se faltar), fim do SLA =
  ENCERRAMENTO lá (não há COD), link `/lotes/:id`, espelho em `{ success, data }` com o resumo da
  desmontagem (racks, máquinas, peças) e materiais — sem pesagens e sem arquivos (o anexo de lá
  exige o login de lá: a aba Documentos manda abrir lá).
- **HTTPS com CA própria:** `integracao/rede.ts` (`fetchComCa`, node:https com `ca`) — a CA vale
  SÓ nas chamadas a esse sistema; campo "Certificado da CA" em Administração › Integração
  (`integracoes.ca_painel`, migration `2026-10-20-02-ca-do-painel`). Sem CA, é o fetch de sempre.
- **Testado neste PC (20/10/2026)** com o MSDC de TESTE em HTTPS (`.claude/scripts/subir-msdc.cmd`,
  servidor `msdc` do launch.json: banco `data\ierp2-teste\msdc.db` de lá, envio ao antigo
  DESLIGADO, CA de teste em `data\ierp2-teste\ca-teste.crt`; login de teste lá admin/admin123, só
  nesse banco): MS901 agendado → recebido → concluído, MS902 recebido, MS903 concluído; site
  SP-HORTO e docas D2/D3 criados no cliente Microsoft; espelho em HTTPS.
- **Revisão (20/10/2026, com testes em `msdc.test.ts`):** lote EXCLUÍDO no MSDC (some do painel e a
  ordem lá responde 404) vira **Cancelado** aqui — lá excluir é o cancelamento (não há
  "cancelado"); concluído excluído fica e aparece em "sumidos"; o campo da CA aceita SÓ
  certificado de verdade (`certificadosValidos`, recusa chave privada); a CA é SOMADA às públicas;
  resposta 204/304 em HTTPS não derruba o servidor; doca trocada lá no mesmo site chega ao lote;
  parâmetro já escrito no endereço do painel não é repetido. **Conhecido, de lá:** chegada
  registrada sem data depois das 21h vira o dia seguinte (o MSDC grava a hora e corta o dia em
  UTC) — afeta o início do SLA; lote sem site lá (os de antes do agendamento e os que vieram pela
  doca do iERP antigo) entra no site "Sem site" do cliente Microsoft.
- **Para produção:** Administração › Integração › Re-Teck MSDC (Microsoft): endereço
  `https://192.168.100.96:5013/api/integracao/painel`, o `INTEGRACAO_TOKEN` do `.env` de lá e o
  certificado público da CA (`ca-reteck.crt`, com o TI). Subir antes a versão do MSDC com as rotas
  novas (sem elas, o 2.0 cria os lotes com o que o painel tem e marca "falhas" nas ordens).

## 0.3 Rastreador de GPS (ReTeckTracker) → Ordens › Viagens (pronto, 20/10/2026)

Sistema `C:\Trabalho\01_Sistemas\reteck-truck-tracking` (ReTeckTracker: .NET 10, API REST + hub
SignalR `/hub/tracking`, app do motorista em `/app/` e APK). É o MESMO rastreador do iERP antigo.
Palavras dele: "Ao agendar uma ordem, ele gera em viagens um card com a viagem do lote podendo
acompanhar ele no mapa."

- **Decisões dele (20/10/2026):** primeira entrega = viagem + mapa ao vivo, **emergência e chat**,
  **camadas do mapa** (Trânsito, Postos/balanças, Pontos); viagem junta (vários lotes num caminhão)
  ficou de fora; lotes do Gerenciamento/MSDC **só para ver**; **receber o lote encerra a viagem**;
  "Usar rastreador" (aparelho no caminhão) **depois** — só o celular agora.
- **Como funciona:** agendar com "Rastrear coleta = Sim" cria a viagem (`ordens_viagens`,
  "Aguardando motorista") com o **código de chegada** de 6 dígitos (nunca no link — é falado no
  destino). O link do motorista é `<rastreador>/app/?os=LOT-…&client=…&driver=…&plate=…` (**sem
  CPF** — ele digita no app; decisão minha por LGPD, o antigo mandava). O app abre a viagem no
  rastreador com o código do lote; o iERP a amarra (pela escuta ao vivo e pela conferência a cada
  minuto — `GET /api/trips?serviceOrder=`), grava o código de chegada (`POST
  /api/trips/{id}/arrival-code`) e acompanha posição, "Cheguei", emergência (ciência = `POST
  …/emergency/ack`, cala o alarme também no antigo), conversa (`…/chat/internal`) e paradas. Termina
  pelo código do motorista, pelo botão **Finalizar** (`POST …/end`) ou pelo **recebimento** do lote
  (rastreador fora do ar não segura o recebimento: `encerrar_no_rastreador` tenta de novo). Ao
  terminar, o trajeto (sem pontos repetidos), as paradas e a conversa ficam **guardados aqui**
  (`ordens_viagens_pontos`) — o replay não depende do rastreador.
- **O antigo não muda nada:** o 2.0 é só mais um ouvinte do hub; mexe só nas viagens dos códigos
  dele (LOT-00001…; o antigo usa LOT-2026…); nunca chama o `DELETE`. Lotes de fora: procura a viagem
  pelo LOT do iERP antigo, que vem no PAINEL do sistema de origem (`painel.lote` = `reteck_lote`; o
  `lote` da ordem é o batch/PO do cliente) — só leitura, nada é gravado lá.
- **No iERP:** `server/src/modules/viagens/` (`rastreador.ts` = cliente HTTP com a chave interna;
  `viagens.ts` = regras, conferência, rotas `/api/viagens`; `tempo-real.ts` = SignalR,
  `@microsoft/signalr` 10.0.11 MIT); migration `2026-10-20-03-viagens`; Administração › Integração
  ganhou o tipo **rastreio** (sistema `RASTREADOR`: endereço, chave interna = `INTERNAL_API_KEY` de
  lá, chave do trânsito TomTom opcional — `integracoes.chave_transito`, nunca sai do servidor).
  Tela `src/features/viagens/` (Em andamento: cards por dia/cliente + mapa; Finalizadas: tabela +
  replay); aviso de emergência no topo de qualquer tela; viagem do lote (card + mapa com as camadas, rota e paradas) na aba Informações enquanto espera o motorista ou está na rua; código de
  chegada no painel de recebimento; eventos `viagem_*` no histórico do lote e de Ordens.
- **Arquivos do trajeto (igual ao antigo):** `GET /api/viagens/:id/exportar/gpx|kml|csv` — só de
  viagem terminada e guardada aqui; mesmo formato e nome de arquivo do iERP antigo
  (cliente_placa_dia_lote). Na tela: Baixar GPX/KML/CSV no replay e no menu ⋯ das Finalizadas.
- **Mapa:** Trânsito = TomTom Traffic Raster Flow (`/traffic/map/4/tile/flow/relative0/…`,
  docs.tomtom.com) pelo servidor (sem chave o botão some); Postos/balanças = Overpass
  (`amenity=fuel` / `amenity=weighbridge`) pelo servidor, uma consulta por região guardada um dia,
  reserva `overpass.private.coffee` (o público principal recusa quando está cheio — visto em
  20/10/2026); Pontos = os sites das viagens.
- **Testado neste PC (20/10/2026)** com o rastreador de TESTE (`.claude/scripts/subir-rastreador.cmd`,
  servidor `rastreador` do launch.json na porta 5283: banco `ReTeckTracker\ierp2-teste\rastreador.db`
  de lá, chaves de teste em `rastreador.env.cmd`, fora do git): início ao vivo, posição, emergência +
  ciência, conversa nos dois sentidos, parada, "Cheguei", código errado recusado e o certo aceito,
  recebimento e Finalizar encerrando lá, lote do Gerenciamento só para ver.
- **Revisão independente (20/10/2026, testes em `viagens.test.ts` › "concorrência"):** tudo o que
  muda uma viagem passa por uma fila POR VIAGEM (`umDeCadaVez`) e relê a viagem antes de mudar — o
  evento ao vivo e a conferência de minuto não se atropelam (um "viagem_finalizada" só; o código
  de chegada gravado UMA vez, para não zerar lá o limite de 5 tentativas; "Cheguei" atrasado não
  reabre viagem recebida). Finalizar grava aqui antes de avisar o rastreador. Emergência que chega
  antes de a viagem ser amarrada fica guardada e é aplicada na amarração (o rastreador não devolve
  a emergência na lista). Recebimento: grava aqui na hora e avisa o rastreador por fora; se o
  motorista tinha saído há segundos (viagem ainda não amarrada), encerra a dele lá também.
  Desligar o rastreio na edição pergunta antes ao rastreador. Viagem apagada lá (404) é arquivada
  sem trajeto. Leituras do rastreador (trajeto, conversa) guardadas 10 s (o rastreador é
  compartilhado); "parada"/"mensagem nova" ao vivo limpam esse cache. Anexo do chat só do próprio
  rastreador. Colunas em `double precision` (PostgreSQL).
- **Efeito no iERP antigo (não quebra, mas aparece):** a tela de viagens do antigo lista TODAS as
  viagens do rastreador, então as do 2.0 (LOT-00001…) aparecem lá sem ordem ligada, e o antigo
  guarda uma cópia delas no histórico dele quando terminam. Não dá para evitar sem mudar o antigo
  (proibido). Se o rastreador usar `INTERNAL_IP` (um IP só), o 2.0 precisa sair pelo mesmo IP do
  antigo.
- **Para produção:** cadastrar em Administração › Integração › Rastreador de GPS o endereço público
  do rastreador e a `INTERNAL_API_KEY` dele (a mesma do antigo; se o rastreador usar `INTERNAL_IP`,
  o 2.0 precisa sair pelo mesmo IP). Chave da TomTom: conta no developer.tomtom.com (com o TI). A
  escuta ao vivo (SignalR) usa certificado público; com CA própria, só a conferência por minuto vale.

## 0.4 Estoque ← armazém, Controle de Notebooks e RTB WMS (pronto, 20/10/2026)

Palavras dele: "Vamos agora integrar três sistemas: C:\Trabalho\01_Sistemas\EC-Inventory-Management,
C:\Trabalho\01_Sistemas\EC-ControleNotebooks e C:\Trabalho\01_Sistemas\EC-rtb-sistema-armazem. Eles
vão ser parte do estoque, respectivamente: Materiais, Assets, Peças e E-commerce."

- **Quem alimenta cada tela:** Materiais ← ARMAZÉM (EC-Inventory-Management, paletes); Assets ←
  CONTROLE DE NOTEBOOKS (Notebook, Desktop, AIO **e Servidor**); Peças ← CONTROLE DE NOTEBOOKS (o
  tipo "Peça"); E-commerce ← RTB WMS (EC-rtb-sistema-armazem, SKU × prateleira). A tela
  **Servidores** continua esperando — "Servidor será um sistema separado" (palavras dele).
- **Decisões dele:** a MESMA chave do iERP antigo no Notebooks e no RTB WMS (eles aceitam uma só,
  a `INTEGRACAO_CHAVE` do .env); no armazém, uma chave PRÓPRIA do 2.0 (lá se geram várias, em
  Sistema › Ajustes › chaves de integração); "Abrir no sistema" vai para a tela geral (os sistemas
  não mandam o número interno — no Notebooks, a lista já buscada pelo serial); leitura AO VIVO
  com 1 minuto guardado (igual ao antigo) e o botão Atualizar.
- **Como funciona:** o 2.0 lê a MESMA porta do antigo, `GET /api/integracao/estoque?pagina=&porPagina=500`
  (cabeçalho `X-Chave-Integracao`, `{ success, data }`), até 8 páginas (4.000 linhas; acima disso
  a tela diz "mostrando N de M"), descartando a linha que reaparece na página seguinte. **Nada
  muda nos três sistemas nem no antigo** (só leitura; a campainha do armazém continua indo só para
  o antigo). Endereço (a RAIZ do sistema) e chave em Administração › Integração (tipo **estoque**:
  `ARMAZEM`, `NOTEBOOKS`, `RTB_WMS`); a última leitura/erro aparece lá.
- **No iERP:** `server/src/modules/estoque/estoque.ts` (`GET /api/estoque/:aba`, tradução de cada
  fonte, cache por sistema que se refaz quando o cadastro muda, uma leitura por vez por sistema,
  "Atualizar" só refaz após 15 s, 15 s de teto para a leitura inteira, sem seguir
  redirecionamento, nunca lança) e `src/features/estoque/` (`EstoqueDeFora` = moldura com
  avisos/Atualizar/Abrir; `paginas.tsx` = colunas; `tons.ts` = a cor de cada estado de lá pelo
  significado — selos `estoque_*` do statusMap com o rótulo de lá; estados do armazém nos 3
  idiomas que ele manda; status/preparo/tipo do Notebooks traduzidos aqui).
- **Testado neste PC (20/10/2026)** com os três de TESTE: `.claude/scripts/subir-armazem-teste.cmd`
  (modo ensaio dele, porta 4010, dados em `.claude/dados-teste/armazem`, campainha desligada;
  login de teste admin/admin123 só lá), `subir-notebooks-teste.cmd` (porta 5231, banco
  `data/teste-ierp2.db` de lá — modo ensaio, sem backup), `subir-wms-teste.cmd` (portas 5020/5021,
  banco `RtbWms/data/teste-ierp2.db`; ele é .NET 8 e roda no .NET 10 por `DOTNET_ROLL_FORWARD`);
  chaves de teste em `estoque.env.cmd` (fora do git). Leu 6 paletes, 3 computadores (com o
  servidor), 1 peça e 2 produtos; a máquina vendida não vem (o Notebooks tira vendido, descartado
  e uso interno da lista).
- **Revisão independente (20/10/2026, testes em `estoque.test.ts`):** falha ao ler o banco não
  derruba o servidor; "Atualizar" apertado várias vezes não vira várias leituras (cada página
  custa ao armazém uma conferência bcrypt); teto de 15 s para a leitura inteira (não por página);
  página HTML no lugar do JSON = "erro de formato"; "próxima página" que não anda não prende;
  a chave não segue redirecionamento; Peças/Assets com lista incompleta não mostram o total de
  todas as máquinas; filtros das colunas com os valores que vieram; filtros e ordem na URL.
- **Estoque › Histórico (pronto, 20/10/2026).** Pedido dele: "Crie também a aba histórico do
  estoque. Faça algo igual as outras de histórico." Decisão dele: **o iERP compara as leituras**
  (os três só mandam a lista de agora). Cada leitura COMPLETA é comparada com a anterior e vira
  **Entrou no estoque / Saiu do estoque / Mudou** (campo, antes e depois) na mesma tabela de
  auditoria dos outros históricos (`HistoricoTabela`; "Usuário" = o sistema de lá; o item é link
  para a tela já buscada por ele). Lê sozinho a cada **5 minutos** (`iniciarEstoqueAoFundo`) e
  quando alguém abre o estoque. A primeira leitura de cada sistema só tira o retrato (sem
  "entrou" para tudo); leitura incompleta ou com falha não conta (um item que não veio não
  "saiu"). Campos: Materiais = estado físico/venda (rótulos de lá nos 3 idiomas), quantidade,
  peso, área, posição; Assets/Peças = situação, preparo, grade, lote de lá; E-commerce = quantidade
  e produto ativo (item = `SKU @ posição`). Código: `server/src/modules/estoque/historico.ts`
  (tabelas `estoque_itens` = último retrato e `estoque_eventos`; `GET /api/estoque/historico?desde=`)
  e `src/features/estoque/HistoricoEstoquePage.tsx`. Conferido com os três de teste: entrou e
  mudou a quantidade no WMS; vendeu e mudou a situação no Notebooks.
- **Para produção:** Administração › Integração: ARMAZEM = `http://<servidor>:4000` + chave gerada
  no armazém para o 2.0; NOTEBOOKS = `http://<servidor>:5012` + a `INTEGRACAO_CHAVE` de lá (a
  mesma do antigo); RTB_WMS = `http://<servidor>:5010` + a `INTEGRACAO_CHAVE` dele (a mesma do
  antigo). Trocar a chave do Notebooks ou do RTB WMS = trocar nos dois iERPs.

## 0.5 Verificação completa dos dois lados (29/10/2026)

Pedido dele: "Verifique novamente a conexão com todos os outros sistemas. Quero algo detalhado,
nada pode falhar!!! Verifique ambos os lados." Como foi feito (repetir assim da próxima vez):

1. **Código do outro lado atualizado:** 7 dos 8 repositórios estavam atrás do GitHub — `git fetch`
   + conferir se os commits novos mexem nas rotas que o 2.0 usa + `git merge --ff-only` (com o "sim"
   dele). O MSDC virou **"MS ITAD"** (o painel ainda diz `sistema: equip-rack-2`) e ganhou
   dependências: `npm ci` + `npx prisma generate` no `backend` (o `npm ci` pula o script que gera o
   Prisma).
2. **Os 7 de teste no ar** pelos `.claude/scripts/subir-*.cmd` (o painel do Terminal do app aceita
   6 abas: os 3 do estoque foram em segundo plano). A tela inicial do MSDC e do armazém dá 500 aqui
   (o frontend deles não está compilado neste PC) — não é a integração.
3. **Lado do iERP:** `integracoes` (última leitura/erro de cada um) + as 4 telas do estoque +
   "Ler agora" do GPS.
4. **Lado de lá, rota por rota, com a chave do 2.0, sem chave e com chave errada** (MSDC: painel,
   lista, ordem por id e por código, espelho; Gerenciamento: idem; armazém/Notebooks/WMS:
   `/api/integracao/estoque`; rastreador: `/api/trips` e o `negotiate` do SignalR; GPS na nuvem:
   chave errada = 401). Banco de teste do MoonShot: `IerpSyncStates` (Id 2 = o 2.0) e
   `OutboundEvents` sem erro; aviso de teste para o MoonShot → ele releu o lote no 2.0 na hora.
5. **Testes de integração dos outros:** MSDC 97/97, armazém 330/331 (o 1 é a tela inicial sem
   frontend compilado), MoonShot 110/110 (`dotnet test --filter FullyQualifiedName~Ierp`).
6. **Ponta a ponta ao vivo com o rastreador** (`scratchpad/teste_vivo_rastreador.py` da sessão):
   lote temporário com 2 caminhões → as 2 viagens começam no rastreador → o 2.0 amarra pelo SignalR
   na hora → ponto de GPS → Finalizar pelo 2.0 → encerradas lá → lote excluído.

**Achado e corrigido:** o rastreador RECUSA (409 "Esta coleta já está sendo rastreada") uma 2ª
viagem ATIVA com o mesmo código, e o 2.0 mandava o mesmo LOT-… para todos os caminhões e celulares
do lote — o 2º motorista não começava. Agora cada viagem tem o seu código, igual ao 1.0
(`codigoDaViagem`): a 1ª o do lote, as seguintes LOT-…-V2, -V3… (`ordens_viagens.codigo_rastreio`,
migration `2026-10-29-01`; `proximoCodigoDaViagem` nunca reusa; vai no link, é por ele que o 2.0
acha a viagem no rastreador; o card mostra "Código no app" quando não é o do lote).

**Riscos que ficam (de fora do iERP):** os servidores públicos do Overpass (camada "Postos/
balanças" do mapa) estavam lotados — o principal responde "at capacity" e os espelhos não
respondem; o iERP segue (a camada fica indisponível e tenta de novo em 2 min). Chave da TomTom
(Trânsito) não cadastrada. Coleta da Nokia no Gerenciamento espera o cadastro do cliente Nokia.
Aparelho gps-5170 sem contato desde 28/10 16:19.

## 1. O que existe hoje

- **Rotas de entrada**: o contrato `/api/integracao/v1` (§0), com chave por sistema. Sistema novo
  usa a mesma porta: inclua o sistema em `DESTINOS` (`destinos.ts`) e em `SISTEMAS_PROCESSAMENTO`
  (`src/features/clientes/configuracoes.ts`), cadastre-o em Administração › Integração e escolha-o
  na aba Configurações de cada cliente.
- **Não há login:** o autor do histórico é "Sistema" (`server/src/shared/autor.ts`) ou o nome do
  sistema de fora; o servidor **não confere permissão** nas rotas de tela — os perfis valem nas telas.
- Tudo o que vier de fora passa pela **camada de serviço** (regras, transação e
  `registrarHistorico`), nunca grava direto nas tabelas — senão some do Histórico/Auditoria.

## 1.1 Sistemas que já falam com o iERP antigo (baixados em `C:\Trabalho\01_Sistemas`, 20/10/2026)

Levantamento pela palavra "iERP" no código/documentação de cada um — **confirmar com o usuário**
antes de começar qualquer um (e a regra de sempre: o antigo NÃO muda, o 2.0 é acrescentado):

| Sistema | O que é | Ligação com o iERP antigo (pelo que a doc dele diz) |
| --- | --- | --- |
| `OP-Re-Teck-MSDC` (equip-rack-2) | Desmontagem de racks da **Microsoft** | **Feito no 2.0 (§0.2)** — só leitura |
| `VDAS-Gerenciamento-Ericsson` | Coletas **Ericsson, AWS, Google (Dell LATAM), Nokia** | **Feito no 2.0 (§0.1)** — só leitura |
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

- **Viagens: pronto (§0.3)** — pelo celular do motorista.
- **Aparelho de GPS no caminhão: pronto (22/10/2026)** — o MESMO método do 1.0 ("esse sistema do
  gps não vai mudar"): o iERP busca os pontos no servidor de GPS (Walker) por PULL
  (`GET <url>?after=<cursor>`, `Authorization: Bearer <chave>`), a cada 5 min, com o PRÓPRIO
  cursor (não atrapalha a leitura do 1.0). Chave = a mesma do 1.0 (decisão dele). Cadastro em
  Administração › Integração (tipo `gps`, sistema `GPS_CAMINHAO`); código em
  `server/src/modules/viagens/gps-caminhao.ts` e `rastreadores.ts`; detalhes no CONTEXTO §5.19.
  **Para produção:** cadastrar a URL da leitura e a chave do 1.0 na Integração.
- **Vários caminhões por lote: pronto (22/10/2026)** — CONTEXTO §5.19. Ainda fica para depois a
  **viagem junta** do antigo (vários lotes de clientes diferentes no mesmo caminhão).

### 2.5 Dashboard — processos de alto valor

- **Onde está:** cards **Harvesting**, **Refurbish** e **Value Recovery** só com texto
  (`src/features/operacao/DashboardOperacaoPage.tsx`, chaves `operacao.dashboard.altoValor.*`).
  Harvesting espera Operação › Chamados internos; Refurbish e Value Recovery esperam "o sistema de
  ITAD novo" (palavras dele).
- **Perguntar:** qual sistema de ITAD, quais números entram em cada card.

### 2.6 Estoque e Operação › Chamados internos

- **Materiais, Assets, Peças, E-commerce e Histórico: prontos (§0.4).** Falta **Servidores** ("será
  um sistema separado" — perguntar qual, quando ele trouxer). Operação › Chamados internos: "em construção" — perguntar de qual sistema.

### 2.7 Login / SSO e permissões no servidor

- **Onde está:** sessão simulada no frontend (`src/stores/session-store.ts`; troca de perfil no menu
  do usuário só para demonstração); `autorDa(req)` devolve "Sistema"; perfis em
  `server/src/modules/perfis/` (permissão = `<página>.<ação>`, `src/config/permissions.ts`).
- A empresa tem skills de SSO com o Portal Re-Teck (`reteck-integracao:*`) — **só aplicar se ele
  pedir**.
- **Quando houver login:** `autorDa` passa a devolver o usuário autenticado; o servidor passa a
  conferir a permissão de cada rota (a mesma regra `can()` do frontend) — MENOS a página pública
  do cliente (`GET /api/publico/rastreio/:token` e a tela `/rastreio/:token`, que ficam abertas:
  o link é o acesso); notificações
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
