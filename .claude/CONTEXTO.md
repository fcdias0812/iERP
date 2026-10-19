# Contexto do Re-Teck iERP v2 — leia antes de continuar

Tudo o que **não está óbvio no código** e que uma sessão nova do Claude (em outro PC, em outra conta)
precisa saber para continuar este sistema do jeito que o usuário pediu. A memória local do Claude
(`~/.claude/projects/...`) **não** vai junto com o repositório — por isso tudo está nesta pasta.

Leia também: [`FLUXO-DE-TRABALHO.md`](FLUXO-DE-TRABALHO.md) (como construir cada pedido, passo a
passo, e as armadilhas do iERP) · [`ARMADILHAS-TEMPLATE.md`](ARMADILHAS-TEMPLATE.md) (decisões e
armadilhas herdadas do template de frontend) · [`../CLAUDE.md`](../CLAUDE.md) (regras obrigatórias
de código) · [`../DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md) · [`../README.md`](../README.md) (APIs).
Para retomar: rode o skill **`/retomar`** (`.claude/skills/retomar/SKILL.md`).

---

## 1. O que é o sistema

- **Re-Teck iERP v2**: ERP da Re-Teck focado em **logística reversa**. É a versão 2 de um sistema
  que já existe (a v1 fica em `C:\Systems\TI-Re-Teck-iERP`, repositório
  `Re-Teck-Brasil/TI-Re-Teck-iERP`). Começou em **18/10/2026**.
- Hoje o iERP serve mais para **visibilidade e junção de vários sistemas de produção** conectados a
  ele (integrações) do que para operação. Muitos submódulos da v1 não são usados (o usuário ainda vai
  dizer quais).
- **Frontend**: nasceu do template padrão da empresa (`C:\Systems\template-padrao`, repositório
  https://github.com/fcdias0812/template-padrao) — design e tecnologias são o padrão da Re-Teck.
- **Backend** (definido pelo usuário): **TypeScript + Node + Express**, banco **SQLite** com migração
  futura para **PostgreSQL**. Implementado em `server/` com Express 5 + Kysely + better-sqlite3.

## 2. Como o usuário quer trabalhar (ordens dele — seguir sempre)

1. **Seguir só o que ele disser.** Não puxar telas, regras, campos nem dados da v1 nem de outro
   lugar. Exceção pedida por ele: o **cálculo da OS** foi portado da v1 (ver §5.6). Para qualquer
   outra coisa da v1, só se ele mandar.
2. **O que não souber, perguntar** — "não tire nada de memória ou achismo". Quando faltar definição,
   fazer as perguntas (de preferência com opções e uma recomendação) **antes** de construir. Se for
   detalhe pequeno e reversível, escolher o mínimo e **avisar**.
3. **Construímos página por página**, na ordem que ele define. Estrutura de menu só muda quando ele
   pede (ele já disse "não mude absolutamente nada ainda" ao revisar a estrutura).
4. **Regra de requisitos dele:** quando ele lista campos, **"op" na frente = opcional; sem "op" =
   obrigatório**. Na dúvida (ex.: texto livre sem "op"), perguntar.
5. **Commits:** só **local** e **só quando ele aprovar** cada um ("Sim, faça o commit local…"). Uma
   mensagem em português por entrega, terminando com a linha de coautoria indicada pela sessão
   (`Co-Authored-By: …`). **Push só quando ele pedir explicitamente.**
6. **Agilidade é prioridade da diretoria:** a informação aparece **já filtrada onde a pessoa está**
   (auditoria/histórico dentro de cada registro e de cada módulo), nada de "ir a outro módulo e
   filtrar". Atalhos de menu podem abrir a mesma lista já filtrada (ex.: "Viagens ativas"). Coisas
   de um registro viram **abas** do detalhe dele. "Não está na lista? Cadastre aqui mesmo" (ex.:
   contato novo direto no site, motorista novo direto na transportadora).
7. **Padrão único de cadastro:** todo cadastro/edição abre no **painel lateral à direita**
   (`CadastroSheet`). Nunca página própria `/novo` ou `/:id/editar`. **Única exceção:** Ordens ›
   Agendamento (página própria). Não abrir outra exceção sem ele pedir.
8. **Excluir = inativar** (o histórico fica), salvo onde ele disser o contrário (sites e documentos
   do cliente podem ser removidos).
9. Respostas em **português do Brasil, linguagem simples**, sem jargão. Ele não é desenvolvedor: diga
   o que mudou na tela e o que ele precisa fazer.
10. **Regra da organização:** pesquisar na web antes de afirmar fato técnico (versão, API, menu,
    configuração). Pacote novo: confirmar versão estável e licença no npm e **fixar versão exata**.
11. Depois de construir, **validar de verdade no navegador** (Chrome) e mostrar o resultado; quando
    ele relatar bug ("trava", "crasha"), **reproduzir antes de corrigir** (ver FLUXO-DE-TRABALHO).
12. Ao fim de cada entrega: rodar o sistema para ele testar, resumir o que mudou, perguntar se pode
    commitar.

## 3. Estado atual (19/10/2026)

Commits na `main` (no GitHub https://github.com/fcdias0812/iERP desde 19/10/2026):

| Commit    | Entrega                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| `abd7bb4` | Início do v2: módulo Admin › Usuários + backend                                          |
| `9a893a4` | Clientes: cadastro com contatos e detalhe em abas                                        |
| `a897897` | Correção do travamento ao abrir Clientes (laço de render na DataTable)                   |
| `538bd99` | Clientes: visão geral, logística (sites/docas/mapa), documentos e histórico              |
| `492ab13` | Relacionamento: Transportadoras, Veículos, Motoristas; cadastro sempre no painel lateral |
| `a66737c` | Operação: menu Ordens/Operação/Estoque; Ordens › Lotes e Agendamento com pré-cálculo     |

Portão de qualidade verde em `a66737c`: lint, typecheck (front e servidor), 59 testes unitários,
57 testes do servidor, 133 e2e (Playwright + axe WCAG 2.2 AA), contraste 158/158, cores, build.

### Menu hoje

| Seção          | Módulo / item                                                              | Situação                                  |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| Principal      | Início                                                                     | painel do template                        |
| Relacionamento | Clientes (item direto)                                                     | **pronto** (6 abas)                       |
|                | Transportadoras (item direto)                                              | **pronto** (detalhe em abas)              |
|                | Veículos (item direto)                                                     | **pronto** (lista + painel)               |
|                | Motoristas (item direto)                                                   | **pronto** (lista + painel)               |
| Operação       | Ordens › **Lotes**                                                         | **pronto** (lista dos lotes agendados)    |
|                | Ordens › **Agendamento**                                                   | **pronto** (página própria + pré-cálculo) |
|                | Ordens › Viagens ativas · Histórico de viagens                             | em construção (rota coringa)              |
|                | Operação › Dashboard · Lotes · Recebimento · Chamados internos · Histórico | em construção                             |
|                | Estoque › Materiais · Assets · Servidores · E-commerce · Peças · Histórico | em construção                             |
| Sistema        | Administração › Usuários                                                   | **pronto**                                |

A seção e um item se chamam "Operação" (aparece **Operação › Operação**). O usuário foi avisado; ainda
não respondeu se quer trocar o nome da seção.

## 4. Estrutura combinada a partir da v1 (referência — só construir o que ele pedir)

Ele mostrou o menu da v1 (Contas, Ordens, Operação, Estoque, Cadastros, Admin) e pediu uma estrutura
melhor. A última versão combinada (antes de começarmos página por página) foi:

- **Relacionamento:** Clientes (abas), Transportadoras.
- **Operação:** Ordens (Agendamento, Viagens ativas, Histórico de viagens, Auditoria) · Operação
  (Dashboard, Lotes, Recebimento, Separação, Conferência, Sanitização, Testes, Desmontagem, Lotes
  travados, Chamados internos, Auditoria) · Estoque (Materiais, Assets, Servidores, Ecommerce, Peças,
  Auditoria).
- **Sistema:** Cadastros (Veículos, Motoristas, Materiais, Caixotes, Áreas, Pontos do mapa,
  Rastreadores GPS) · Administração (Usuários, Perfis de acesso, Auditoria, Integração (API)).

Respostas do usuário sobre a v1 (18/10/2026):

1. **Transportadoras** vão para Relacionamento. Alguns veículos são das transportadoras e outros da
   Re-Teck, mas ficam **todos juntos** numa lista, porque ao criar a ordem um cálculo escolhe o veículo.
   → Depois ele pediu **Transportadoras, Veículos e Motoristas como itens separados em Relacionamento**
   (é o que existe hoje).
2. **Lotes** de Ordens e de Operação são **o mesmo lote** visto de perspectivas diferentes. → Em
   19/10 ele pediu **as duas entradas de menu**: Ordens › Lotes (lotes agendados) e Operação › Lotes.
3. **Materiais**: em Cadastros = materiais que podem ser usados no sistema; em Estoque = materiais
   gerados para estoque. (Sugeri chamar o de Cadastros de "Catálogo de materiais" — sem resposta.)
4. **Cargos** = perfis de acesso de cada um ("Perfis de acesso").
5. **Recebimento → Separação → Conferência → Sanitização → Testes → Desmontagem** são as etapas do
   lote. Mas como o iERP é mais visibilidade, muitos submódulos não são usados — ele vai dizer quais.
6. Ao montar o menu de Operação (19/10) ele listou só: Ordens (Agendamento, Viagens ativas, Histórico
   de viagens) · Operação (Dashboard, Lotes, Recebimento, Chamados internos, Histórico) · Estoque
   (Materiais, Assets, Servidores, ecommerce, Peças, Histórico) — e depois pediu **Lotes em primeiro**
   em Ordens. "Auditoria" virou **"Histórico"** em cada módulo.

## 5. Decisões por módulo (o que ele pediu)

### 5.1 Administração › Usuários

Primeiro módulo pedido. Lista, detalhe e cadastro (painel lateral). Perfis: `admin`, `operacao`,
`leitura` (matriz em `src/config/permissions.ts`). **Login/autenticação ainda não definido**: sessão
simulada no front; o histórico grava "Sistema" como autor (`server/src/shared/autor.ts`).

### 5.2 Clientes (Relacionamento)

- Item direto no menu (na v1 era "Contas › Clientes"; "Contas" foi abandonado porque lembra
  financeiro). Cadastro: **nome, CNPJ** (aceita CNPJ alfanumérico) e **contatos** (nome, e-mail,
  telefone; um ou mais; o **principal** é o primeiro).
- Detalhe com abas (`?aba=`): **Visão geral** · **Contatos** · **Logística** · **Documentos** ·
  **Configurações** · **Histórico**.
  - **Visão geral:** KPIs de lotes **a chegar / em operação / finalizados** + card com os **últimos 5
    lotes** que tiveram atualização. A API devolve `conectado: false` até a integração de lotes existir.
  - **Contatos:** o principal **sempre em primeiro e destacado** (barra azul-petróleo à esquerda —
    ele recusou o destaque com a cor do cabeçalho).
  - **Logística:** **Sites** com código do site, região, horário de funcionamento, total de gaylords,
    endereço, localização com **mapa** (por CEP ou latitude/longitude), shredder próprio (sim/não),
    edge (sim/não), contato responsável (da lista **ou novo** — o novo entra automaticamente em
    Contatos). **Docas** do site: número, altura máx. do caminhão (m), comprimento máx. do caminhão
    (m), dock leveler, tail lift, área do lift (m²), espaço (m²), altura (m), voltagem do shredder,
    proteção do piso obrigatória. CEP → endereço via ViaCEP; endereço → coordenadas via Nominatim
    pelo servidor, em cascata (endereço completo → sem bairro → cidade, com `precisao: 'cidade'`).
  - **Documentos:** vários tipos (hoje `contrato`, `fiscal`, `licenca`, `outro`) em várias extensões
    (PDF, DOC/X, XLS/X, CSV, TXT, XML, JPG/PNG/WEBP, ZIP), até 25 MB, guardados em
    `server/data/arquivos`.
  - **Configurações:** "deixe a definir por enquanto" (tela "em definição").
  - **Histórico:** ele quer **auditoria em tabela** (não linha do tempo): data, quem, ação, campo,
    antes, depois, nota — com filtros e exportação.

### 5.3 Transportadoras, Veículos e Motoristas (Relacionamento) — 18/10/2026

- **Transportadoras:** nome, CNPJ, contatos (nome, e-mail, telefone; mais de um; **opcionais**; se
  houver, um principal). Um ou mais **motoristas vinculados**; se o motorista não está na lista, é
  **criado na hora** (como os contatos dos sites). Detalhe em abas: Dados, Contatos, Motoristas,
  Histórico.
- **Veículos:** tipo (**truck, carreta, van** — "por enquanto apenas esses"), **volume mínimo**,
  **volume máximo**, comprimento (m), largura (m), **capacidade em pallets** ("capacidade em volume" =
  quantos pallets cabem), capacidade em toneladas. **Sem placa** ("cada transportadora pode ter vários
  trucks; a placa só se escolhe na hora de usar"). Não vinculado a motorista nem a transportadora.
  - **19/10:** volume mínimo/máximo passaram a ser **quantidade de volumes** (pallets + gaylords +
    racks), não m² — é o que o cálculo da OS usa para escolher o veículo.
- **Motoristas:** nome completo, CPF, telefone e transportadora vinculada (opcional); se a
  transportadora não existe, **pode ser criada ali**.
- "Transportadora e motorista não precisam ter vinculações, isso é opcional."
- Os três: **inativar em vez de excluir**; histórico na tabela única `historico`.

### 5.4 Padrão de cadastro (18/10/2026)

Ele estranhou que Clientes/Transportadoras abriam página própria e Veículos/Motoristas um painel:
"Quero um padrão! Utilize o modal na direita para cadastros." → `CadastroSheet` para todos (inclusive
Usuários). Lista: `?aberto=novo|<id>`; detalhe: `?editar=true`. Depois de criar um registro que tem
página de detalhe, abre o detalhe.

### 5.5 Ordens › Lotes e Ordens › Agendamento (19/10/2026)

- **Ordens › Lotes** (primeiro item de Ordens): lista dos **lotes agendados**. Cada ordem criada no
  Agendamento é um lote `LOT-00001` com status **Agendado**.
- **Agendamento** — "único cadastro com página própria". Campos (regra do "op"):
  - **Cliente** → **site** (só depois do cliente) → **doca** (só depois do site): obrigatórios.
  - Transportadora (op) · Nº do lote de referência do cliente (op) · **Data de coleta (obrigatória —
    pedido de 19/10)** · Coleta prevista (op) · Data de chegada (op).
  - **Rastrear a coleta** (sim/não). Se sim: motorista (op, da lista cadastrada) e placa do caminhão (op).
  - **Serviços:** I. PSM (gaylords triturados); II. Onsite Shredding (DBD); III. Recycle Only;
    IV. Value Recovery (Racks); V. Value Recovery (ITAD). **III e IV já vêm marcados** (os mais comuns).
  - **Quantidade:** Boxes (op), Pallets (op), Gaylords (op), Racks (op), **Placas de policarbonato
    necessárias** (obrigatória e **só aparece com o serviço IV**), **requer pallets vazios** (sim/não;
    se sim, **quantidade de pallets vazios** — resposta dele), **itens com mais de 25 kg** (sim/não),
    **fator limitante** (texto livre, **opcional** — resposta dele).
  - **Anexos da OS:** **Escopo de trabalho** e **Observações & anexos**, cada um com texto livre e
    envio de documentos (como em Clientes). **Só o escopo é obrigatório**, e vale **texto OU arquivo**
    (resposta dele).
  - Botões **Criar ordem** e **Pré-calcular**. O pré-cálculo mostra num card ao lado: total de
    volumes, caminhão, capacidade do caminhão, número de viagens, pessoas, caminhão com plataforma,
    levar shredder, levar gaylord, levar pallet vazio (+ avisos).

### 5.6 Cálculo da OS (pré-cálculo)

Pedido dele: "Utilize o cálculo no sistema `C:\Systems\TI-Re-Teck-iERP`". Portado **fielmente** de
`backend/src/lib/calculoOs.js` (que veio do Re-Teck EMS) para `server/src/modules/ordens/ordens.calculo.ts`,
com os **mesmos casos de teste** (`ordens.calculo.test.ts`). Mudar número do cálculo = decisão de
negócio (perguntar). Resumo:

- Volumes = pallets + gaylords + racks (**boxes não contam**); peso não entra.
- Caminhão desejado = o veículo **ativo** cuja faixa de volumes contém o total (ordenados pelo
  comprimento; acima da última faixa, o maior). Se não cabe na doca (comprimento máx. e espaço m² ≥
  comprimento × largura), usa o maior que cabe; se nenhum cabe, o menor + aviso.
- Viagens = ⌈volumes ÷ capacidade em pallets⌉ (mínimo 1). Pallets vazios não ocupam capacidade.
- Pessoas = 2 + 2 (Onsite Shredding) + 1 (Recycle Only) + 2 a cada 10 racks (Value Recovery).
- Caminhão com plataforma = doca **sem** dock leveler **ou** com tail lift.
- Levar shredder = Onsite Shredding; levar gaylord = Recycle Only; levar pallets vazios = requer e
  quantidade > 0.
- Diferenças da v1: entram todos os veículos ativos (não há "usar no cálculo"); avisos saem como
  códigos traduzidos na tela; pré-calcular não grava nada; o resultado é guardado na ordem ao criar.

## 6. Perguntas em aberto (fazer quando chegar a hora)

- **Clientes:** outros tipos de documento além de contrato/fiscal/licença/outro? O limite de 25 MB
  serve? Quais etapas do lote contam como "a chegar", "em operação" e "finalizado" na Visão geral?
  O que vai na aba Configurações?
- **Login/SSO:** como será a autenticação (hoje simulada). A empresa tem skills de SSO com o Portal
  Re-Teck (`reteck-integracao:*`) — só aplicar se ele pedir.
- **Menu:** quais submódulos da v1 não são usados; se troca o nome da seção "Operação"; se Cadastros
  (Caixotes, Áreas, Pontos do mapa, Rastreadores GPS, Materiais) e Administração (Perfis de acesso,
  Integração) entram.
- **Ordens:** etapas de uma viagem (Viagens ativas / Histórico de viagens); se o lote ganha página de
  detalhe; o que acontece com o rastreio (a v1 gerava link/QR para o motorista — **não** foi pedido);
  editar/cancelar ordem.
- **Operação e Estoque:** de qual sistema de produção vêm os dados (integração) e o que se cadastra
  no próprio iERP; diferença entre Materiais, Assets, Servidores, E-commerce e Peças.
- **Publicação:** nada foi publicado em servidor ainda (a empresa tem skills `reteck-skills:deploy`
  etc. — só com pedido dele).

## 7. Próximo passo sugerido

Ele escolhe. Opções já levantadas: Viagens ativas / Histórico de viagens; página de detalhe do lote;
Operação › Lotes e as etapas; Estoque. Antes de construir qualquer uma, fazer as perguntas da §6
correspondentes.
