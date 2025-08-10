@echo off
set STARTUP_MODE=1
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-client.ps1" > "%~dp0startup-log.txt" 2>&1
