@echo off
chcp 65001 >nul
title ZierClaw 一键安装

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     🖋️  ZierClaw 一键安装向导         ║
echo    ║     墨驱动的 AI 私人助手              ║
echo    ╚══════════════════════════════════════╝
echo.
echo    正在启动安装程序...
echo    后续全部在 PowerShell 中完成
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"Write-Host ''; ^
Write-Host '   正在下载 OpenClaw 官方安装脚本...' -ForegroundColor Cyan; ^
Write-Host ''; ^
iwr -useb https://openclaw.ai/install.ps1 | iex; ^
Write-Host ''; ^
Write-Host '   正在启动初始化向导...' -ForegroundColor Cyan; ^
Write-Host ''; ^
openclaw onboard --install-daemon; ^
Write-Host ''; ^
Write-Host '   ╔══════════════════════════════════╗' -ForegroundColor Green; ^
Write-Host '   ║     ✅ 全部完成！                ║' -ForegroundColor Green; ^
Write-Host '   ║                                  ║' -ForegroundColor Green; ^
Write-Host '   ║  启动: openclaw gateway start    ║' -ForegroundColor Green; ^
Write-Host '   ║  技能: https://lanzier.github.io ║' -ForegroundColor Green; ^
Write-Host '   ╚══════════════════════════════════╝' -ForegroundColor Green; ^
Write-Host ''"

if %errorlevel% neq 0 (
    echo.
    echo    ╔══════════════════════════════════════╗
    echo    ║  ❌ 安装遇到问题                     ║
    echo    ║                                      ║
    echo    ║  可能原因：                          ║
    echo    ║  1. 网络问题，检查代理或VPN          ║
    echo    ║  2. 杀毒软件拦截                     ║
    echo    ║                                      ║
    echo    ║  手动安装：                          ║
    echo    ║  Win+R → powershell → 输入:          ║
    echo    ║  iwr -useb https://openclaw.ai/     ║
    echo    ║  install.ps1 ^| iex                   ║
    echo    ╚══════════════════════════════════════╝
)

echo.
pause
