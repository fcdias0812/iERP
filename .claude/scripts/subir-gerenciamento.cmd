@echo off
rem Sobe o Gerenciamento de Projetos (VDAS-Gerenciamento-Ericsson) SO NESTE PC, para testar a
rem integracao com o iERP 2.0: banco de TESTE proprio (data\coletas-ierp2-teste.db, fora do git
rem de la) e o envio ao iERP antigo DESLIGADO (INTEGRACAO_URL vazio: nada sai daqui).
setlocal
set "GP=%~dp0..\..\..\VDAS-Gerenciamento-Ericsson"
if not exist "%GP%\src\server.js" (
  echo Gerenciamento nao encontrado em %GP%
  exit /b 1
)
set "DB_PATH=%GP%\data\coletas-ierp2-teste.db"
set "PORT=5005"
set "INTEGRACAO_SEGREDO="
if exist "%~dp0gerenciamento.env.cmd" call "%~dp0gerenciamento.env.cmd"
set "INTEGRACAO_URL="
cd /d "%GP%"
node src/seed.js
node src/server.js
