@echo off
REM CRM Hira - Windows 1-Click Desktop Runner
cd /d "%~dp0"
set PYTHONPATH=.
set PORT=8080

echo ==================================================
echo  Starting CRM Hira Desktop Server
echo  Address: http://localhost:%PORT%
echo ==================================================

REM Launch in standalone App Window Mode (Chrome/Edge) or default browser
start "" msedge --app=http://localhost:%PORT% 2>nul || start "" chrome --app=http://localhost:%PORT% 2>nul || start http://localhost:%PORT%

python -m app.backend.server %PORT%
pause
