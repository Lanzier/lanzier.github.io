Write-Host ""
Write-Host "   ZierClaw One-Click Install" -ForegroundColor Cyan
Write-Host "   Installing OpenClaw..." -ForegroundColor Cyan
Write-Host ""

try {
    iwr -UseBasicParsing -Uri "https://openclaw.ai/install.ps1" | iex
    Write-Host ""
    Write-Host "   ✅ Installation complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Next step: openclaw onboard --install-daemon" -ForegroundColor Yellow
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host "   ❌ Installation failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Please check your internet connection and try again." -ForegroundColor Red
}

Read-Host "Press Enter to exit"
