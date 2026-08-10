@echo off
chcp 65001 >nul
title ZierClaw OpenClaw Installer
echo ================================================
echo   ZierClaw OpenClaw One-Click Install
echo ================================================
echo.

:: Ask for admin (request elevation)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Need admin rights, requesting elevation...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: cd to this script's folder (so install.ps1 is found)
cd /d "%~dp0"

echo [1/2] Location: %~dp0
echo [2/2] Running installer...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
