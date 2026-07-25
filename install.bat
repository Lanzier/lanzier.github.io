@echo off
chcp 65001 >nul
title ZierClaw 一键安装

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     🖋️  ZierClaw 一键安装向导         ║
echo    ║     墨驱动的 AI 私人助手              ║
echo    ╚══════════════════════════════════════╝
echo.
echo    [1/2] 正在安装 OpenClaw...
echo    这需要几分钟，请耐心等待
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://openclaw.ai/install.ps1 | iex"

if %errorlevel% neq 0 (
    echo.
    echo    ❌ 安装失败，请检查网络连接
    echo    手动安装：Win+R → powershell → 输入：
    echo    iwr -useb https://openclaw.ai/install.ps1 ^| iex
    echo.
    pause
    exit /b 1
)

echo.
echo    ✅ 安装完成！
echo.
echo    [2/2] 正在启动初始化向导...
echo    将在新窗口中完成配置
echo.

start powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command ^
"Write-Host ''; ^
Write-Host '    🖋️  ZierClaw 初始化向导' -ForegroundColor Cyan; ^
Write-Host '    按提示配置 AI 模型 API Key' -ForegroundColor Cyan; ^
Write-Host ''; ^
openclaw onboard --install-daemon; ^
Write-Host ''; ^
Write-Host '   ╔══════════════════════════════════╗' -ForegroundColor Green; ^
Write-Host '   ║     ✅ 全部完成！                ║' -ForegroundColor Green; ^
Write-Host '   ║  启动: openclaw gateway start    ║' -ForegroundColor Green; ^
Write-Host '   ║  技能: https://lanzier.github.io ║' -ForegroundColor Green; ^
Write-Host '   ╚══════════════════════════════════╝' -ForegroundColor Green; ^
Write-Host ''"

echo.
echo    初始化向导已在新窗口打开，请切换到新窗口完成配置
echo.
pause
