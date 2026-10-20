@echo off
rem Sobe o CONTROLE DE NOTEBOOKS (EC-ControleNotebooks) SO NESTE PC, para testar Estoque > Assets
rem e Pecas do iERP 2.0: banco de TESTE (data\teste-ierp2.db, pasta ignorada pelo git de la;
rem nome diferente de controle.db = modo ensaio, sem backup automatico), porta 5231 e a chave de
rem teste de estoque.env.cmd (fora do git daqui). O banco de verdade nao e tocado.
setlocal
set "SIS=%~dp0..\..\..\EC-ControleNotebooks\ControleNotebooks"
if not exist "%SIS%\Program.cs" (
  echo Controle de Notebooks nao encontrado em %SIS%
  exit /b 1
)
call "%~dp0estoque.env.cmd"
set "ASPNETCORE_ENVIRONMENT=Development"
cd /d "%SIS%"
dotnet run --no-launch-profile -- --Banco=data/teste-ierp2.db --Urls=http://localhost:5231 --INTEGRACAO_CHAVE=%NOTEBOOKS_CHAVE%
