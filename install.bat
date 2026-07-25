@echo off
chcp 65001 >nul
title ZierClaw 一键安装

echo.
echo    ╔══════════════════════════════════════╗
echo    ║     🖋️  ZierClaw 一键安装向导         ║
echo    ║     墨驱动的 AI 私人助手              ║
echo    ╚══════════════════════════════════════╝
echo.
echo    正在安装 OpenClaw...
echo    这需要几分钟，请耐心等待
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -NoOnboard"

if %errorlevel% neq 0 (
    echo.
    echo    ❌ 安装失败，请检查网络连接
    echo.
    echo    手动安装（打开 PowerShell 运行）：
    echo    iwr -useb https://openclaw.ai/install.ps1 ^| iex
    echo.
    pause
    exit /b 1
)

echo.
echo    ✅ OpenClaw 已安装！
echo.
echo    ┌──────────────────────────────────────────────┐
echo    │  接下来在新窗口中完成初始化配置：             │
echo    │  按 Win+R → 输入 powershell → 回车         │
echo    │  然后运行：openclaw onboard --install-daemon  │
echo    │  按提示填入 AI 模型 API Key 即可              │
echo    └──────────────────────────────────────────────┘
echo.
echo    技能商店：https://lanzier.github.io
echo.
echo    是否现在打开初始化窗口？ (Y/N)
choice /c YN /n /m "  选择 [Y/N]: "

if %errorlevel% equ 1 (
    start powershell -NoExit -NoProfile -Command ^
"Write-Host ''; ^
Write-Host '   🖋️  欢迎！请在下方按提示完成配置' -ForegroundColor Cyan; ^
Write-Host ''; ^
openclaw onboard --install-daemon"
)

echo.
echo    完成后，可以随时运行 openclaw gateway start 启动服务
echo.
pause
