@echo off
chcp 65001 >nul
title ZierClaw 一键安装

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     🖋️  ZierClaw 一键安装向导         ║
echo    ║     墨驱动的 AI 私人助手              ║
echo    ╚══════════════════════════════════════╝
echo.
echo    正在检查环境...

:: ── 1. Check Node.js ──
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo    ⚠️  未检测到 Node.js，正在自动安装...
    echo.
    echo    下载 Node.js LTS 版本中...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.15.0/node-v24.15.0-x64.msi' -OutFile '%TEMP%\node-install.msi'" 2>nul
    if %errorlevel% neq 0 (
        echo    ❌ 下载失败，请手动安装 Node.js:
        echo       https://nodejs.org
        echo       安装后重新运行本脚本
        pause
        exit /b 1
    )
    echo    正在安装 Node.js（需要管理员权限）...
    msiexec /i "%TEMP%\node-install.msi" /passive /norestart
    echo    ✅ Node.js 安装完成，请重新运行本脚本
    pause
    exit /b 0
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo    ✅ Node.js 已安装 (%NODE_VER%)

:: ── 2. Check npm ──
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo    ❌ npm 未找到，请检查 Node.js 安装
    pause
    exit /b 1
)

:: ── 3. Install OpenClaw ──
echo.
echo   正在安装 OpenClaw（可能需要几分钟）...
call npm install -g openclaw@latest

if %errorlevel% neq 0 (
    echo.
    echo    ❌ 安装失败，请检查网络连接
    echo    提示：中国大陆用户可能需要代理
    pause
    exit /b 1
)

echo    ✅ OpenClaw 安装完成

:: ── 4. Run onboarding ──
echo.
echo   正在启动初始化向导...
echo   按提示配置你的 AI 模型（API Key 等）
echo.
call openclaw onboard --install-daemon

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     ✅ 安装完成！                    ║
echo    ║                                      ║
echo    ║  启动命令: openclaw gateway start    ║
echo    ║  查看状态: openclaw status           ║
echo    ║  技能商店: https://lanzier.github.io ║
echo    ║                                      ║
echo    ║  现在可以对墨说:                     ║
echo    ║  "帮我查一下今天天气"                ║
echo    ║  "搜索xxx的最新消息"                 ║
echo    ║  "帮我写一封邮件"                    ║
echo    ╚══════════════════════════════════════╝
echo.
pause
