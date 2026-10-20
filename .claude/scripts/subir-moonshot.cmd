@echo off
rem Sobe o MoonShot (sistema de processamento da Dell) para testar a integracao com o iERP.
rem O repositorio dele fica AO LADO do iERP: ..\BD-Moonshot-Operation-Scan (ou MOONSHOT_DIR).
rem
rem  - Feito para .NET 8; DOTNET_ROLL_FORWARD=Major deixa rodar no .NET mais novo instalado.
rem  - Banco de TESTE em data\raw\moonshot-dev do MoonShot (fora do git dele): nunca o de producao.
rem  - Endereco: http://localhost:5063 (so este PC)
rem  - Usuario de teste: data\raw\moonshot-dev\USUARIO-DE-TESTE.txt do MoonShot (fora do git).
rem  - Integracao: IERP_BASE_URL / IERP_API_KEY / IERP_PUBLIC_URL / IERP_PAINEL_TOKEN (ver o
rem    .env.example do MoonShot). Sem elas ele roda sozinho, sem falar com o iERP.

if "%MOONSHOT_DIR%"=="" set "MOONSHOT_DIR=%~dp0..\..\..\BD-Moonshot-Operation-Scan"
if not exist "%MOONSHOT_DIR%\src\dotnet\MoonShot\MoonShot.sln" (
  echo MoonShot nao encontrado em "%MOONSHOT_DIR%". Defina MOONSHOT_DIR.
  exit /b 1
)

if "%MOONSHOT_DATA_PATH%"=="" set "MOONSHOT_DATA_PATH=%MOONSHOT_DIR%\data\raw\moonshot-dev"
if not exist "%MOONSHOT_DATA_PATH%" mkdir "%MOONSHOT_DATA_PATH%"
set DOTNET_ROLL_FORWARD=Major
rem Variaveis de TESTE da integracao (IERP2_*, painel): arquivo local gerado, fora do git.
if exist "%~dp0moonshot.env.cmd" call "%~dp0moonshot.env.cmd"

cd /d "%MOONSHOT_DIR%\src\dotnet\MoonShot"
rem So neste PC (o appsettings dele abre para a rede toda: 0.0.0.0).
dotnet run --project MoonShot.Web --launch-profile localhost -- --urls http://localhost:5063
