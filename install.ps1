# ZierClaw One-Click Install
# 自动定位到脚本所在目录（无论从哪个路径打开都生效）
if ($PSScriptRoot) {
    Set-Location -Path $PSScriptRoot
    Write-Host "   切换到脚本目录: $PSScriptRoot" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "   ZierClaw One-Click Install" -ForegroundColor Cyan
Write-Host "   Installing OpenClaw..." -ForegroundColor Cyan
Write-Host ""

# Check node
$nodeOk = $false
try { $v = node -v 2>$null; if ($v) { $nodeOk = $true; Write-Host "   Node.js found: $v" -ForegroundColor Green } } catch {}

if (-not $nodeOk) {
    Write-Host "   Node.js not found. Installing via winget..." -ForegroundColor Yellow

    # Try winget first
    $wingetOk = $false
    try { winget --version 2>$null; $wingetOk = $true } catch {}

    if ($wingetOk) {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        try { $v = node -v 2>$null; if ($v) { $nodeOk = $true; Write-Host "   Node.js installed: $v" -ForegroundColor Green } } catch {}
    }

    if (-not $nodeOk) {
        Write-Host "   Could not install Node.js automatically." -ForegroundColor Red
        Write-Host "   Please install manually: https://nodejs.org" -ForegroundColor Yellow
        Write-Host "   (Download the LTS version, run the installer, then re-run this script)" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Check Git
$gitOk = $false
try { $gv = git --version 2>$null; if ($gv) { $gitOk = $true; Write-Host "   Git found: $gv" -ForegroundColor Green } } catch {}
if (-not $gitOk) {
    Write-Host "   Git not found. Installing via winget..." -ForegroundColor Yellow
    $winget2Ok = $false
    try { winget --version 2>$null; $winget2Ok = $true } catch {}
    if ($winget2Ok) {
        winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        try { $gv = git --version 2>$null; if ($gv) { $gitOk = $true; Write-Host "   Git installed: $gv" -ForegroundColor Green } } catch {}
    }
    if (-not $gitOk) {
        Write-Host "   Could not install Git automatically." -ForegroundColor Yellow
        Write-Host "   Please install manually: https://git-scm.com" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host ""
Write-Host "   ================================================" -ForegroundColor Cyan
Write-Host "   Installation complete!" -ForegroundColor Green
Write-Host "   ================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   One more step to make it usable:" -ForegroundColor Yellow
Write-Host "   You need to add your AI model API key." -ForegroundColor Yellow
Write-Host ""

# ── 关键：引导用户配置模型 API Key（这样才真正可用）────────────
Write-Host "   We will now open the API-key setup." -ForegroundColor Cyan
Write-Host "   (Choose your AI provider, then paste your API key when asked.)" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Where to get keys:" -ForegroundColor Yellow
Write-Host "   - DeepSeek : https://platform.deepseek.com -> API Keys" -ForegroundColor White
Write-Host "   - OpenAI   : https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "   - OpenRouter: https://openrouter.ai/keys" -ForegroundColor White
Write-Host ""
Write-Host "   Opening setup in 3 seconds..." -ForegroundColor DarkGreen
Start-Sleep -Seconds 3

try {
    openclaw models auth add
    Write-Host ""
    Write-Host "   API key configured. Now setting default model..." -ForegroundColor Cyan
    openclaw models set
    Write-Host ""
    Write-Host "   Finish: install the daemon so it runs in the background." -ForegroundColor Cyan
    Write-Host "   Next step (run manually, or we try now):" -ForegroundColor White
    Write-Host "   openclaw onboard --install-daemon" -ForegroundColor White
    Write-Host ""
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "   Skipped interactive setup (or openclaw not on PATH yet)." -ForegroundColor Yellow
    Write-Host "   Open a NEW PowerShell window and run:" -ForegroundColor Yellow
    Write-Host "   openclaw models auth add" -ForegroundColor White
    Write-Host "   openclaw models set" -ForegroundColor White
    Write-Host "   openclaw onboard --install-daemon" -ForegroundColor White
    Write-Host ""
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Cyan
    Write-Host ""
}

Read-Host "Press Enter to exit"
