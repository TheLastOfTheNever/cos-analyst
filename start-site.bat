@echo off
setlocal
cd /d "%~dp0"

set "SITE_URL=http://127.0.0.1:8000/index.html"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-site.ps1" -Check >nul 2>nul
if not errorlevel 1 goto open_site

where powershell.exe >nul 2>nul
if errorlevel 1 (
    echo Windows PowerShell was not found. This launcher requires Windows PowerShell 5.1 or later.
    pause
    exit /b 1
)

start "SOC Academy HTTP server" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-site.ps1"

set /a attempts=0

:check_server
timeout /t 1 /nobreak >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-site.ps1" -Check >nul 2>nul
if not errorlevel 1 goto open_site

set /a attempts+=1
if %attempts% lss 15 goto check_server

echo The site server did not start on port 8000.
echo Make sure the port is available, then run this file again.
pause
exit /b 1

:open_site
start "" "%SITE_URL%"
endlocal
