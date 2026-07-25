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

:: Step 1: Run official installer
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://openclaw.ai/install.ps1 | iex"

if %errorlevel% neq 0 (
    echo.
    echo    ╔══════════════════════════════════════╗
    echo    ║  ❌ 安装失败                         ║
    echo    ║                                      ║
    echo    ║  可能原因:                           ║
    echo    ║  1. 网络问题，检查网络或代理          ║
    echo    ║  2. 杀毒软件拦截，暂时关闭重试        ║
    echo    ║  3. 手动安装: https://openclaw.ai     ║
    echo    ╚══════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

:: Step 2: Run onboarding via PowerShell (fresh PATH)
echo.
echo    ✅ OpenClaw 已安装，正在初始化...
echo.
echo    请在新的 PowerShell 窗口中完成配置。
echo.
echo    ┌─────────────────────────────────────────┐
echo    │  如果此窗口卡住，请直接:                 │
echo    │  按 Win+R → 输入 powershell → 回车       │
echo    │  然后运行: openclaw onboard              │
echo    └─────────────────────────────────────────┘
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "refreshenv 2>$null; openclaw onboard --install-daemon"

if %errorlevel% neq 0 (
    echo.
    echo    ⚠️  自动启动失败（PATH 未刷新）
    echo    请手动操作:
    echo    1. 关闭此窗口
    echo    2. 打开新的 PowerShell（Win+R → powershell）
    echo    3. 运行: openclaw onboard --install-daemon
)

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     ✅ 安装完成！                    ║
echo    ║                                      ║
echo    ║  启动:  openclaw gateway start       ║
echo    ║  状态:  openclaw status              ║
echo    ║  技能:  https://lanzier.github.io    ║
echo    ╚══════════════════════════════════════╝
echo.
pause
