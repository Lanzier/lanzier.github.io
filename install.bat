@echo off
title ZierClaw Installer

echo ZierClaw One-Click Install
echo Installing OpenClaw...
echo.

powershell -Command "iwr -useb https://openclaw.ai/install.ps1 | iex"

echo.
echo Done. If successful, open a NEW PowerShell window and run:
echo   openclaw onboard --install-daemon
echo.
echo https://lanzier.github.io
echo.
pause
