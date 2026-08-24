@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to play from this folder.
  echo Install it from https://nodejs.org then double-click Play.bat again.
  echo.
  echo Or open this folder in VS Code and use Live Server on index.html.
  pause
  exit /b 1
)
echo Starting Christmas Catch...
echo Keep this window open while you play. Close it to stop.
echo.
node scripts\phone.js --local --open
