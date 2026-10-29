# Implantação do iERP 2.0 no servidor

Guia para a sessão do Claude (ou o TI) que vai **subir o iERP 2.0 no servidor da Re-Teck** e
deixá-lo no ar **em paralelo com o iERP 1.0**. Escrito em 29/10/2026, no PC de desenvolvimento,
com tudo o que foi conferido lá. Leia inteiro antes de começar.

> **Segredos não estão aqui, nem no git.** As chaves e tokens das integrações o usuário entrega
> por fora (lista na §6). Nunca grave chave em arquivo do repositório, em memória do Claude ou
> em mensagem de commit. Quem digita as chaves reais na tela é o usuário.

---

## 0. Regras que mandam em tudo

1. **O iERP 1.0 não muda.** Ele segue no ar (`C:\Sistemas\Re-Teck iERP`, container `reteck-ierp`,
   porta 5000, dados em `D:\Dados\ti\re-teck-ierp`). Não pare, não recrie, não mexa no `.env`
   nem no banco dele. A integração dos outros sistemas com o 2.0 é **só por acréscimo**: nada do
   que eles já fazem com o 1.0 pode mudar.
2. **Rastreador de GPS (ReTeckTracker):** é o MESMO do 1.0. O 2.0 só mexe nas viagens dos lotes
   dele (`LOT-…`). **Nunca apague nada lá.**
3. **Um 2.0 ligado por vez em cada sistema de fora.** Os códigos dos lotes (`LOT-00001`…)
   recomeçam em cada banco: se o PC de desenvolvimento e o servidor apontarem para o MESMO
   rastreador/MoonShot de verdade, os códigos se chocam. O servidor é o único 2.0 ligado aos
   sistemas reais; o PC de desenvolvimento fica nos sistemas de teste (`.claude/scripts/subir-*.cmd`).
4. **Backup do banco ANTES de qualquer subida** (o servidor aplica as migrations sozinho ao
   iniciar).
5. **Commit só com o "sim" do usuário; push só quando ele pedir** (vale para este repositório e
   para os outros).
6. **Ainda não existe login** (ver §7): o 2.0 fica **só na rede interna** até o login existir.
7. Pesquise na web antes de afirmar fato técnico (regra da organização).

## 1. O que vai rodar

- **Uma imagem Docker** (`Dockerfile` na raiz) com as telas compiladas (React/Vite) e a API
  (Node 24 + Express 5) **na mesma porta**: o Express entrega as telas quando a variável
  `SITE_DIR` existe (`server/src/app.ts`, `entregarTelas`).
- **Banco SQLite** (`ierp.sqlite`, modo WAL) + **arquivos enviados** (documentos, fotos,
  anexos das ordens) numa pasta de dados montada do disco D.
- `docker-compose.yml` na raiz: projeto **`reteck-ierp-v2`**, container **`reteck-ierp-v2`**.
  O `name:` é obrigatório — sem ele o Compose pode confundir o serviço `app` com o do 1.0 e
  recriar o container dele.
- Ao iniciar, o servidor **aplica as migrations pendentes** e liga as tarefas de fundo:

  | Tarefa                                                                                  | Intervalo       | Código                        |
  | --------------------------------------------------------------------------------------- | --------------- | ----------------------------- |
  | Avisos para o MoonShot (fila com reenvio) e leitura do painel dele                      | 30 s            | `integracao/sincronizacao.ts` |
  | Gerenciamento de Projetos e MSDC (sistemas de origem: painel; lista inteira a cada 6 h) | 30 s            | `integracao/gerenciamento.ts` |
  | Rastreador: escuta ao vivo (SignalR `/hub/tracking`) + conferência                      | ao vivo + 1 min | `viagens/tempo-real.ts`       |
  | Servidor de GPS dos caminhões (pull com cursor próprio; falha → tenta em 1 min)         | 5 min           | `viagens/gps-caminhao.ts`     |
  | Estoque › Histórico (armazém, Notebooks, RTB WMS)                                       | 5 min           | `estoque/historico.ts`        |

  Sem a integração cadastrada, cada tarefa simplesmente não faz nada.

- **Saúde:** `GET /api/health` → `{"ok":true,"success":true}` (também `/api/saude`). A imagem
  tem `HEALTHCHECK` com ele.

### Variáveis

Servidor (já definidas no `docker-compose.yml`; o `.env` só traz porta e pasta):

| Variável                   | Na imagem                | Para quê                                                                   |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `PORT`                     | 3000 (dentro da caixa)   | a porta do SERVIDOR vem do `.env` (`PORT`) e é mapeada para 3000           |
| `DB_FILE`                  | `/app/data/ierp.sqlite`  | arquivo do banco                                                           |
| `ARQUIVOS_DIR`             | `/app/data/arquivos`     | arquivos enviados                                                          |
| `SITE_DIR`                 | `/app/site`              | telas compiladas (sem ela, a API não entrega telas)                        |
| `TZ`                       | `America/Sao_Paulo`      | relógio de Brasília (o banco guarda UTC; as telas formatam em SP)          |
| `GEO_CONTATO`              | `rtbrti03@re-teckbr.com` | e-mail no User-Agent do Nominatim (exigência do serviço)                   |
| `GPS_LEITURA_INTERVALO_MS` | vazio (= 5 min)          | não mude sem motivo                                                        |
| `DATABASE_URL`             | —                        | só para o futuro PostgreSQL (`server/src/db/database.ts`); hoje não é lida |

Telas (entram **no build**; mudou = `docker compose up -d --build`):

| Variável                                            | Para quê                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `VITE_ESRI_API_KEY`                                 | fundo "Satélite" do mapa do Dashboard (sem ela o botão não aparece)      |
| `VITE_MAP_TILES_URL` / `VITE_MAP_TILES_ATTRIBUTION` | outro provedor de mapa (padrão OpenStreetMap)                            |
| `IERP_BUILD`                                        | identificador da versão no `version.json` (padrão: data e hora do build) |
| `VITE_USE_MOCKS`                                    | **nunca** em produção (API simulada) — o Dockerfile não passa            |

## 2. Pré-requisitos no servidor

- **Docker Desktop aberto** (`docker info` responde) — ele não sobe sozinho no Windows.
- **git** com acesso ao repositório **https://github.com/fcdias0812/iERP** (é particular: o
  servidor precisa de credencial do GitHub com leitura nele — pergunte ao usuário).
- **Saída para a internet** (ver §8) e acesso pela rede interna aos sistemas da §5.
- `C:\Sistemas\registro-portas.json` (registro central de portas) e o disco **D:**.
- Skill da empresa útil: `reteck-skills:deploy` (passo a passo padrão: backup → sobe → saúde →
  volta sozinho se falhar) e `reteck-skills:checar-risco`.

## 3. Primeira implantação (passo a passo)

1. **Pasta e código.** Ao lado do 1.0:
   ```powershell
   cd C:\Sistemas
   git clone https://github.com/fcdias0812/iERP.git "Re-Teck iERP 2.0"
   cd "C:\Sistemas\Re-Teck iERP 2.0"
   git log -1 --oneline   # anote: é o ponto de volta
   ```
2. **Porta.** Abra `C:\Sistemas\registro-portas.json`, pegue a **próxima porta livre**, reserve
   para `re-teck-ierp-v2` e confira que ninguém escuta nela (`Get-NetTCPConnection -LocalPort <porta>`).
3. **`.env`.** `copy .env.servidor.example .env` e preencha `PORT` (a reservada) e
   `DATA_PATH=D:\Dados\ti\re-teck-ierp-v2`. Crie a pasta.
4. **Banco: novo ou cópia?** — **pergunte ao usuário.** Recomendação: **banco novo**. O banco do
   PC de desenvolvimento tem dados fictícios do seed, lotes de teste (Dell, Microsoft…) e as
   integrações apontando para os sistemas de TESTE em `localhost`. Banco novo = a pasta vazia; o
   servidor cria tudo ao subir (perfis de acesso, tipos de documento etc. vêm das migrations).
   **Nunca rode `db:seed` no servidor** (cria dados fictícios).
   Se ele quiser a cópia mesmo assim: pare a API no PC de desenvolvimento, copie
   `server/data/ierp.sqlite` (+ `-wal`/`-shm`, se existirem) e a pasta `server/data/arquivos`
   para o `DATA_PATH`, e **antes** de ligar os sistemas reais troque TODOS os endereços da
   Administração › Integração (os de lá são `localhost`) e apague os lotes de teste.
5. **Firewall.** Libere a porta na rede interna (perfil Domínio/Privado), igual às dos outros
   sistemas. Não abra para a internet (§7).
6. **Subir.**
   ```powershell
   docker compose up -d --build
   docker logs -f reteck-ierp-v2    # deve mostrar "Migrations aplicadas: …" e "iERP API em …"
   ```
7. **Saúde.** `Invoke-WebRequest http://127.0.0.1:<PORT>/api/health -UseBasicParsing` → 200
   `{"ok":true,"success":true}`. Abra `http://<ip-do-servidor>:<PORT>/` de outro PC da rede.
8. **Endereço amigável (se o servidor usa Caddy, como manda a skill `deploy`):** entrada
   `<nome>.reteck.internal` → `localhost:<PORT>` e `caddy reload`. Veja como o 1.0 está publicado e
   faça igual. Com HTTPS no iERP, as fotos do Gerenciamento (links HTTP de lá) seriam bloqueadas
   pelo navegador — nesse caso avise o usuário (§9).
9. **Cadastros antes das integrações de origem** (com o usuário): os lotes do Gerenciamento e do
   MSDC entram no cliente CADASTRADO aqui, achado **pelo nome** (sem cliente, a coleta espera). Os
   clientes Dell, Microsoft, AWS, Nokia… precisam existir antes (com CNPJ, sites e docas). Os
   clientes da Dell vão para o MoonShot pela aba **Configurações do cliente › Sistema de
   processamento**.
10. **Integrações** — §5, uma por uma, conferindo cada uma na hora.
11. **Conferência final** — §10.
12. **Registre:** porta, pasta, commit publicado e onde ficou o backup. Atualize o
    `.claude/CONTEXTO.md` deste repositório com o que foi feito (commit só com o "sim" dele).

## 4. Atualizar (versões seguintes) e voltar atrás

```powershell
cd "C:\Sistemas\Re-Teck iERP 2.0"
$antes = git rev-parse HEAD
$agora = Get-Date -Format "yyyy-MM-dd-HHmm"
# 1) backup do banco COM ele no ar (cópia consistente, mesmo em WAL):
docker exec reteck-ierp-v2 node -e "new (require('better-sqlite3'))('/app/data/ierp.sqlite').backup('/app/data/ierp.sqlite.backup-$agora').then(()=>console.log('backup ok'))"
# 2) código novo e subida:
git pull
docker compose up -d --build
# 3) saúde:
Invoke-WebRequest http://127.0.0.1:<PORT>/api/health -UseBasicParsing
```

- **Não respondeu?** Volte: `docker compose stop`, `git checkout $antes`, copie o
  `ierp.sqlite.backup-<data>` por cima do `ierp.sqlite` (apague `ierp.sqlite-wal` e `-shm` antes),
  `docker compose up -d --build`, confira a saúde e avise o usuário com o erro do `docker logs`.
- Quem estiver com o iERP aberto vê o aviso **"versão nova"** (o `version.json` nunca fica
  guardado no navegador; quem adiar fica com "?" no botão Novidades). Nada a fazer.
- **Backup de rotina:** a pasta `D:\Dados\ti\re-teck-ierp-v2` inteira (banco + `arquivos/`), com o
  mesmo comando `backup` acima (não copie o `ierp.sqlite` com o servidor gravando). Combine com o
  TI a frequência (a mesma do 1.0).

## 5. Integrações (Administração › Integração)

Tudo é cadastrado **na tela** (o banco guarda; a chave que o iERP gera fica só em hash). Dentro
do container, **`localhost` é o próprio container**: use o IP do servidor (ou
`host.docker.internal`) para os sistemas que rodam nele. Conferido de ponta a ponta em 29/10/2026
com as versões do GitHub (`.claude/INTEGRACOES.md` §0.5). Todos estão na `main` dos repositórios
deles; confirme que a versão EM PRODUÇÃO de cada um é a mesma (ou mais nova) antes de ligar.

| Sistema (código na tela)                               | Endereço                                                                                                   | Chave/token (vem do usuário)                                                                                                | Do outro lado                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MoonShot (Dell)** `MOONSHOT` — processamento         | avisos `http://<moonshot>/api/ierp2/avisos`; painel `http://<moonshot>/api/ierp2/painel`                   | token do painel = o `IERP_PAINEL_TOKEN` do `.env` do MoonShot. Depois clique **Gerar chave** (aparece UMA vez)              | no `.env` do MoonShot, **acrescentar** `IERP2_BASE_URL=http://<servidor>:<PORT>` e `IERP2_API_KEY=<a chave gerada>` e reiniciar o MoonShot. As `IERP_*` do 1.0 ficam como estão |
| **Gerenciamento de Projetos** `GERENCIAMENTO` — origem | `http://<servidor>:5005/api/integracao/painel`                                                             | o `INTEGRACAO_TOKEN` do `.env` de lá                                                                                        | nada                                                                                                                                                                            |
| **Re-Teck MSDC / MS ITAD** `MSDC` — origem             | `https://192.168.100.96:5013/api/integracao/painel`                                                        | o `INTEGRACAO_TOKEN` de lá + colar o **certificado público da CA** (`ca-reteck.crt`, com o TI) no campo "Certificado da CA" | nada (a versão com as rotas novas já está na `main` de lá)                                                                                                                      |
| **Rastreador de GPS** `RASTREADOR` — rastreio          | o endereço PÚBLICO do ReTeckTracker (o mesmo que o 1.0 usa no `TRACKER_URL`)                               | a `INTERNAL_API_KEY` dele (a mesma do 1.0, `TRACKER_INTERNAL_KEY`). Opcional: chave da TomTom (camada Trânsito)             | nada. Se o rastreador limita por `INTERNAL_IP`, o 2.0 sai pelo mesmo IP do 1.0 (mesmo servidor = ok)                                                                            |
| **Servidor de GPS dos caminhões** `GPS_CAMINHAO` — gps | `https://gps-cloud.reteck-gps.workers.dev/ierp/v1/points?after=<cursor>`                                   | o token do 1.0 (o usuário tem e cadastra)                                                                                   | nada (cursor próprio; não atrapalha o 1.0)                                                                                                                                      |
| **Armazém** `ARMAZEM` — estoque                        | `http://<servidor>:<porta do armazém>` (o 1.0 usa o `ARMAZEM_URL`; nas notas antigas, 4000/5002 — confira) | uma chave NOVA gerada na tela do armazém para o 2.0                                                                         | gerar a chave lá                                                                                                                                                                |
| **Controle de Notebooks** `NOTEBOOKS` — estoque        | `http://<servidor>:5012`                                                                                   | a `INTEGRACAO_CHAVE` de lá (a mesma do 1.0, `NOTEBOOKS_CHAVE`)                                                              | nada                                                                                                                                                                            |
| **RTB WMS** `RTB_WMS` — estoque                        | `http://<servidor>:5010` (a raiz, sem `/admin`)                                                            | a `INTEGRACAO_CHAVE` de lá (a mesma do 1.0, `RTB_WMS_CHAVE`)                                                                | nada                                                                                                                                                                            |

- Os endereços de produção do 1.0 são uma boa fonte: estão no `.env` dele
  (`C:\Sistemas\Re-Teck iERP\.env`: `TRACKER_URL`, `ARMAZEM_URL`, `NOTEBOOKS_URL`, `RTB_WMS_URL`,
  `ORIGEM_ESPELHO`). **Só leia**; os valores secretos de lá também servem, mas peça ao usuário
  para confirmar antes de usá-los.
- Depois de salvar cada uma, confira na própria tela ("Último contato", "Painel lido em", erro) e
  na tela que usa: Estoque (Materiais/Assets/Peças/E-commerce), Ordens › Viagens, lotes
  "Processamento i/N", "Ler agora" do GPS em Cadastros › Rastreadores GPS.
- **MoonShot:** só os lotes de clientes com "Sistema de processamento = MoonShot" vão para lá;
  sem a planilha `.xlsx` no lote, o MoonShot guarda o lote mas não cria o lote de trabalho (regra
  dele).
- **Rastreador:** cada viagem tem o seu código no app do motorista (`LOT-…`, `LOT-…-V2`…); as
  viagens do 2.0 aparecem também na tela de viagens do 1.0 (sem ordem ligada) — esperado.

## 6. O que o usuário entrega por fora (nunca no git)

- token do GPS na nuvem (ele mesmo cadastra);
- `IERP_PAINEL_TOKEN` do MoonShot (e acesso ao `.env` do MoonShot para acrescentar `IERP2_*`);
- `INTEGRACAO_TOKEN` do Gerenciamento e do MSDC;
- `ca-reteck.crt` (certificado PÚBLICO da CA; a chave `.key` nunca sai de lá);
- `INTERNAL_API_KEY` do rastreador e o endereço público dele;
- chave do armazém para o 2.0; `INTEGRACAO_CHAVE` do Notebooks e do RTB WMS;
- opcionais: chave da TomTom; chave da Esri (`VITE_ESRI_API_KEY`, vai no `.env` e exige rebuild);
- credencial do GitHub para clonar; a porta escolhida e o IP/nome do servidor.

## 7. Segurança — ainda não há login

- Todo mundo que abre o endereço entra como o usuário simulado; o servidor não confere
  permissão; o autor do histórico é "Sistema". **Mantenha o 2.0 só na rede interna.**
- Não publique a porta na internet — nem para a página pública do cliente (`/rastreio/<token>`):
  ela está na mesma porta que todo o resto. Isso só depois do login (com essa página e
  `GET /api/publico/rastreio/:token` fora dele) — `.claude/INTEGRACOES.md` §2.7.
- O contrato com os sistemas de fora (`/api/integracao/v1`) já exige `X-Api-Key`.

## 8. O que o servidor acessa na internet

ViaCEP (CEP), Nominatim/OpenStreetMap (endereço → coordenadas; 1 consulta/s), MyMemory
(tradução — nada sigiloso vai traduzido), Overpass (camada "Postos/balanças" do mapa; os
servidores públicos às vezes lotam — a camada fica indisponível e tenta de novo em 2 min), o GPS
na nuvem (`workers.dev`) e o rastreador. O NAVEGADOR de quem usa baixa os mapas do OpenStreetMap
(e Esri/TomTom, se houver chave). Proxy da empresa bloqueando algum deles = só aquela parte
para.

## 9. Riscos e pendências conhecidos (29/10/2026)

- Coleta da Nokia no Gerenciamento espera o cadastro do cliente Nokia.
- Aparelho `gps-5170` sem contato desde 28/10 16:19.
- Chave da TomTom não cadastrada (sem a camada Trânsito).
- Fotos do espelho do Gerenciamento são links HTTP de lá: com o iERP em HTTPS, o navegador
  bloqueia (servir pelo servidor do iERP — mudança de código, perguntar).
- O nome "Re-Teck MSDC (Microsoft)" pode virar "MS ITAD" (decisão do usuário).

## 10. Conferência depois de subir (repetir a cada versão com mudança de integração)

1. `docker ps` → `reteck-ierp-v2` "healthy"; `docker ps` também mostra o `reteck-ierp` (1.0)
   intacto, e `http://127.0.0.1:5000/api/health` do 1.0 responde.
2. Telas abrem sem erro no console: Início, Clientes, Ordens › Lotes/Agendamento/Viagens,
   Operação › Dashboard/Recebimento, Estoque (4 abas + Histórico), Cadastros, Administração.
3. Administração › Integração: cada sistema com "Último contato" recente e sem erro.
4. Lado de lá, com a chave do 2.0, sem chave e com chave errada (esperado: 200, 401, 401) —
   roteiro em `.claude/INTEGRACOES.md` §0.5.
5. MoonShot: lote de teste de um cliente Dell, recebido no 2.0 → aparece no MoonShot (tela
   "iERP") → combinar com o usuário e excluir depois.
6. Rastreador: lote de teste com "Rastrear coleta" → abrir o link do motorista → a viagem aparece
   em Ordens › Viagens com ponto no mapa → Finalizar → excluir o lote (Excluir só vale para
   agendado sem caminhão na rua).
7. Novidades e aviso de versão: depois de um rebuild, uma aba aberta mostra "versão nova".

## 11. Onde está cada coisa

- Servidor: `server/src/index.ts` (sobe, migra, liga as tarefas), `server/src/app.ts` (rotas e
  `entregarTelas`), `server/src/config.ts` (variáveis), migrations em `server/src/db/migrations/`.
- Integrações: `server/src/modules/integracao/`, `viagens/`, `estoque/`; detalhes e decisões em
  `.claude/INTEGRACOES.md`; estado do projeto em `.claude/CONTEXTO.md`.
- Desenvolvimento (não é produção): `npm run dev` + `npm run dev:api`; sistemas de teste em
  `.claude/scripts/subir-*.cmd`.
