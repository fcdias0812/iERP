@echo off
rem Sobe o ARMAZEM (EC-Inventory-Management) SO NESTE PC, para testar Estoque > Materiais do
rem iERP 2.0: o modo de ENSAIO dele (AMBIENTE marcado, porta 4010) com a pasta de dados em
rem .claude\dados-teste\armazem (fora do git daqui). A campainha para o iERP antigo fica DESLIGADA.
rem Nada do armazem de verdade e tocado. Login de teste la: admin/admin123 (so nesta pasta).
setlocal
set "SIS=%~dp0..\..\..\EC-Inventory-Management"
if not exist "%SIS%\backend\src\index.js" (
  echo Armazem nao encontrado em %SIS%
  exit /b 1
)
set "DATA_PATH=%~dp0..\dados-teste\armazem\dados"
set "BACKUP_PATH=%~dp0..\dados-teste\armazem\backups"
if not exist "%DATA_PATH%" mkdir "%DATA_PATH%"
set "PORT=4010"
set "AMBIENTE=TESTE iERP 2.0"
set "IERP_AVISO_URL="
set "IERP_AVISO_CHAVE="
cd /d "%SIS%"
node scripts\rodar-sem-docker.js
