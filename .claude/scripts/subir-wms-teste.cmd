@echo off
rem Sobe o RTB WMS (EC-rtb-sistema-armazem) SO NESTE PC, para testar Estoque > E-commerce do
rem iERP 2.0: banco de TESTE (RtbWms\data\teste-ierp2.db, pasta ignorada pelo git de la),
rem portas 5020/5021 e a chave de teste de estoque.env.cmd. Ele e .NET 8: roda no .NET 10 deste
rem PC por DOTNET_ROLL_FORWARD. O banco de verdade nao e tocado.
setlocal
set "SIS=%~dp0..\..\..\EC-rtb-sistema-armazem\RtbWms"
if not exist "%SIS%\Program.cs" (
  echo RTB WMS nao encontrado em %SIS%
  exit /b 1
)
call "%~dp0estoque.env.cmd"
set "INTEGRACAO_CHAVE=%RTB_WMS_CHAVE%"
set "DOTNET_ROLL_FORWARD=Major"
set "ASPNETCORE_ENVIRONMENT=Development"
cd /d "%SIS%"
dotnet run --no-launch-profile -- --DbPath=data/teste-ierp2.db --HttpPort=5020 --HttpsPort=5021
