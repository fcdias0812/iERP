@echo off
rem Sobe o Re-Teck MSDC (OP-Re-Teck-MSDC, equip-rack-2 da Microsoft) SO NESTE PC, para testar a
rem integracao com o iERP 2.0: banco de TESTE proprio (data\ierp2-teste, fora do git de la), o envio
rem ao iERP antigo DESLIGADO (INTEGRACAO_URL vazio: nada sai daqui) e HTTPS com uma CA de TESTE
rem (data\ierp2-teste\ca-teste.crt — e ela que se cola em Administracao > Integracao > MSDC).
setlocal
set "MSDC=%~dp0..\..\..\OP-Re-Teck-MSDC"
if not exist "%MSDC%\backend\src\index.js" (
  echo MSDC nao encontrado em %MSDC%
  exit /b 1
)
set "TESTE=%MSDC%\data\ierp2-teste"
set "DATABASE_URL=file:%TESTE%\msdc.db"
set "DATA_PATH=%TESTE%"
set "PORT=5013"
set "CERT_CRT=%TESTE%\certificados\servidor.crt"
set "CERT_KEY=%TESTE%\certificados\servidor.key"
set "URL_PUBLICA=https://localhost:5013"
set "INTEGRACAO_SEGREDO="
if exist "%~dp0msdc.env.cmd" call "%~dp0msdc.env.cmd"
set "INTEGRACAO_URL="
cd /d "%MSDC%\backend"
call npx prisma migrate deploy
node src/index.js
