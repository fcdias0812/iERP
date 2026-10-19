---
name: retomar
description: Retoma o Re-Teck iERP v2 em uma sessão nova — lê todo o contexto do projeto, sincroniza com o GitHub, sobe os servidores, confere que está tudo verde e pergunta ao usuário qual é o próximo pedido.
disable-model-invocation: true
---

# Retomar o Re-Teck iERP v2

Siga nesta ordem, sem pular:

1. **Ler o contexto inteiro** (obrigatório):
   - `.claude/CONTEXTO.md` — o que é o sistema, **as ordens do usuário** (como ele quer trabalhar),
     decisões por módulo, estado atual, perguntas em aberto.
   - `.claude/FLUXO-DE-TRABALHO.md` — rito de cada pedido, comandos, validação no Chrome, banco de
     desenvolvimento, armadilhas do iERP, regras de commit/push.
   - `CLAUDE.md` (regras obrigatórias de código) e `DESIGN-SYSTEM.md`.
   - `.claude/ARMADILHAS-TEMPLATE.md` quando for mexer em frontend.
2. **Sincronizar:** `git status` (não descartar nada local sem perguntar) e `git pull` na `main`
   (https://github.com/fcdias0812/iERP). `npm install` e `npm --prefix server install` se não houver
   `node_modules` ou se o `package-lock.json` mudou. Banco inexistente → `npm --prefix server run db:seed`.
3. **Subir os servidores** `api` e `web` (`.claude/launch.json`) e conferir que
   `http://localhost:5173` abre e `http://localhost:3001/api/saude` responde.
4. **Conferir o ponto de partida** (portão de qualidade do FLUXO-DE-TRABALHO §2.7). Se algo estiver
   vermelho, avisar o usuário antes de começar trabalho novo.
5. **Resumir para o usuário**, em português simples: o que já existe, o que está "em construção" e as
   perguntas em aberto da §6 do CONTEXTO. Perguntar **qual é o próximo pedido** (ou seguir o que ele
   escreveu em `$ARGUMENTS`).
6. **Trabalhar no rito** do FLUXO-DE-TRABALHO §2: perguntar o que estiver indefinido → backend →
   frontend → mocks → e2e → portão → validar no Chrome → documentar (inclusive atualizar o
   `.claude/CONTEXTO.md` com as decisões novas) → mostrar → **pedir permissão para commitar**.
   Push só quando ele pedir.
