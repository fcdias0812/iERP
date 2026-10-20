@echo off
rem Sobe o rastreador de GPS (ReTeckTracker, reteck-truck-tracking) SO NESTE PC, para testar
rem Ordens > Viagens do iERP 2.0: banco SQLite de TESTE proprio (ReTeckTracker\ierp2-teste, fora do
rem git de la: *.db e ignorado) e chaves de TESTE (rastreador.env.cmd, fora do git daqui). O mesmo
rem codigo do rastreador de verdade; nada do repositorio dele e alterado.
setlocal
set "RASTREADOR=%~dp0..\..\..\reteck-truck-tracking\ReTeckTracker"
if not exist "%RASTREADOR%\src\ReTeckTracker.Server\Program.cs" (
  echo Rastreador nao encontrado em %RASTREADOR%
  exit /b 1
)
set "TESTE=%RASTREADOR%\ierp2-teste"
if not exist "%TESTE%" mkdir "%TESTE%"
set "DATABASE_URL=Data Source=%TESTE%\rastreador.db"
set "PORT=5283"
set "ASPNETCORE_ENVIRONMENT=Development"
if exist "%~dp0rastreador.env.cmd" call "%~dp0rastreador.env.cmd"
cd /d "%RASTREADOR%\src\ReTeckTracker.Server"
dotnet run --no-launch-profile
