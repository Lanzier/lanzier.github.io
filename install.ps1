# ZierClaw One-Click Install
# Auto-elevates to admin if needed for Node.js installation

Write-Host ""
Write-Host "   ZierClaw One-Click Install" -ForegroundColor Cyan
Write-Host "   Installing OpenClaw..." -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "   Requesting administrator privileges (needed for Node.js install)..." -ForegroundColor Yellow
    Write-Host ""
    Start-Sleep 1

    $scriptPath = $MyInvocation.MyCommand.Path
    if (-not $scriptPath) {
        $scriptPath = Join-Path $PSScriptRoot "install.ps1"
    }

    try {
        Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
        Write-Host "   A new admin window has opened. Please check that window." -ForegroundColor Green
        Write-Host ""
        Read-Host "Press Enter to close this window"
        exit 0
    } catch {
        Write-Host "   Could not elevate. Trying without admin..." -ForegroundColor Yellow
    }
}

# Already admin or elevation failed — try install anyway
try {
    iwr -UseBasicParsing -Uri "https://openclaw.ai/install.ps1" | iex
    Write-Host ""
    Write-Host "   Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Next step: openclaw onboard --install-daemon" -ForegroundColor Yellow
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "   Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Try running PowerShell as Administrator:" -ForegroundColor Yellow
    Write-Host "   1. Press Win+R, type powershell" -ForegroundColor White
    Write-Host "   2. Press Ctrl+Shift+Enter (run as admin)" -ForegroundColor White
    Write-Host "   3. Run: .\install.ps1" -ForegroundColor White
    Write-Host ""
}

Read-Host "Press Enter to exit"
