@echo off
chcp 65001 >nul
title ZierClaw 一键安装

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     🖋️  ZierClaw 一键安装向导         ║
echo    ║     墨驱动的 AI 私人助手              ║
echo    ╚══════════════════════════════════════╝
echo.
echo    正在启动 OpenClaw 官方安装程序...
echo    这将自动安装 Node.js + OpenClaw
echo.

:: Use official installer via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://openclaw.ai/install.ps1 | iex"

if %errorlevel% neq 0 (
    echo.
    echo    ╔══════════════════════════════════════╗
    echo    ║  ❌ 安装失败                         ║
    echo    ║                                      ║
    echo    ║  可能原因:                           ║
    echo    ║  1. 网络连接问题，请检查网络          ║
    echo    ║  2. 需要关闭杀毒软件重试              ║
    echo    ║  3. 手动安装: https://openclaw.ai     ║
    echo    ╚══════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

:: Refresh PATH (npm global bin may not be in current session)
for /f "tokens=*" %%i in ('npm config get prefix') do set NPM_PREFIX=%%i
set "PATH=%NPM_PREFIX%;%PATH%"

:: Run onboarding
echo.
echo    ✅ 安装完成，正在启动初始化向导...
echo.
openclaw onboard --install-daemon

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     ✅ 全部完成！                    ║
echo    ║                                      ║
echo    ║  启动:  openclaw gateway start       ║
echo    ║  状态:  openclaw status              ║
echo    ║  技能:  https://lanzier.github.io    ║
echo    ║                                      ║
echo    ║  试试对墨说：                        ║
echo    ║  "帮我查今天天气"                    ║
echo    ║  "搜xxx最新消息"                     ║
echo    ║  "帮我写邮件"                        ║
echo    ╚══════════════════════════════════════╝
echo.
pause
