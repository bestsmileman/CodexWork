@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-maru.ps1" -Stop
if errorlevel 1 pause
