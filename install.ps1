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
        Write-Host "   winget not available. Downloading Node.js LTS installer directly..." -ForegroundColor Yellow
        # 下载 Node 官方 LTS msi 静默安装（不依赖 winget）
        try {
            $msi = Join-Path $env:TEMP "node-lts.msi"
            Write-Host "   Downloading from nodejs.org ..." -ForegroundColor Cyan
            $dl = Invoke-WebRequest -Uri "https://nodejs.org/dist/latest-v22.x/" -UseBasicParsing -ErrorAction Stop
            # 从目录页匹配 x64.msi 下载链接
            $match = [regex]::Match($dl.Content, 'node-v[\d.]+-x64\.msi')
            if ($match.Success -and $match.Value) {
                $file = $match.Value
                $nodeUrl = "https://nodejs.org/dist/latest-v22.x/" + $file
                Write-Host "   Downloading $file ..." -ForegroundColor Cyan
                Invoke-WebRequest -Uri $nodeUrl -OutFile $msi -UseBasicParsing -ErrorAction Stop
                Write-Host "   Installing Node.js silently..." -ForegroundColor Cyan
                $msiArgs = '/i "' + $msi + '" /qn'
                Start-Process msiexec -ArgumentList $msiArgs -Wait
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                try { $v = node -v 2>$null; if ($v) { $nodeOk = $true; Write-Host "   Node.js installed: $v" -ForegroundColor Green } } catch {}
            } else {
                Write-Host "   Could not resolve Node download URL." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Auto-install failed: $($_.Exception.Message)" -ForegroundColor Red
        }
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

# Check / Install OpenClaw
$ocOk = $false
try { $ochk = Get-Command openclaw -ErrorAction SilentlyContinue; if ($ochk) { $ocOk = $true; Write-Host "   OpenClaw found: $($ochk.Source)" -ForegroundColor Green } } catch {}

if (-not $ocOk) {
    Write-Host "   OpenClaw not found. Installing via official installer..." -ForegroundColor Yellow
    try {
        irm https://openclaw.ai/install.ps1 | iex
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        try { $ochk = Get-Command openclaw -ErrorAction SilentlyContinue; if ($ochk) { $ocOk = $true; Write-Host "   OpenClaw installed: $($ochk.Source)" -ForegroundColor Green } } catch {}
    } catch {
        Write-Host "   OpenClaw auto-install failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    if (-not $ocOk) {
        Write-Host "   Please install OpenClaw manually (admin PowerShell):" -ForegroundColor Yellow
        Write-Host "   iwr -useb https://openclaw.ai/install.ps1 | iex" -ForegroundColor White
        Write-Host "   then re-run this installer." -ForegroundColor Yellow
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

# ── 确保 openclaw 命令可用（刷新 PATH，含 npm 全局目录）──────
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$npmGlobal = Join-Path $env:APPDATA "npm"
if (Test-Path $npmGlobal) { $env:Path = $npmGlobal + ";" + $env:Path }
$ocChk = Get-Command openclaw -ErrorAction SilentlyContinue
if ($ocChk) { Write-Host "   openclaw ready: $($ocChk.Source)" -ForegroundColor Green }
else { Write-Host "   Warning: openclaw not found on PATH yet." -ForegroundColor Yellow }
Write-Host ""

# ── 启动 OpenClaw 官方模型选择向导（openclaw onboard）────────────
Write-Host "   Launching OpenClaw model setup wizard..." -ForegroundColor Cyan
Write-Host "   (Follow the on-screen prompts to choose your AI provider + API key.)" -ForegroundColor Cyan
Write-Host ""
Start-Sleep -Seconds 1

try {
    # 官方模型选择界面 / 初始化向导（选 deepseek/kimi/自用 key 等）
    openclaw onboard
    Write-Host ""
    Write-Host "   Setup complete! Starting the Dashboard..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    try { openclaw dashboard } catch {}
    Write-Host ""
    Write-Host "   If it did not open, run:  openclaw dashboard" -ForegroundColor Yellow
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "   Skipped the wizard (openclaw may need a new terminal)." -ForegroundColor Yellow
    Write-Host "   Open a NEW PowerShell window and run:" -ForegroundColor Yellow
    Write-Host "   openclaw onboard" -ForegroundColor White
    Write-Host ""
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Cyan
    Write-Host ""
}


# -------------------------------------------------------------------
# ZierClaw 启动器 + 桌面图标（第2层机箱外壳）
# 动态探测 openclaw 绝对路径，写入 vbs，不依赖运行时 PATH
# -------------------------------------------------------------------
Write-Host "   Finalizing ZierClaw launcher..." -ForegroundColor Cyan
Write-Host ""
try {
    # 0) 确保 npm 全局目录进 PATH（一劳永逸）
    $npmGlobal = Join-Path $env:APPDATA "npm"
    if (Test-Path $npmGlobal) {
        $userPath = [Environment]::GetEnvironmentVariable("Path","User")
        if ($userPath -notlike "*" + $npmGlobal + "*") {
            [Environment]::SetEnvironmentVariable("Path", $userPath + ";" + $npmGlobal, "User")
            Write-Host "   Added npm global to PATH: $npmGlobal" -ForegroundColor Green
        }
        $env:Path = $npmGlobal + ";" + $env:Path
    }

    # 1) 探测 openclaw 真实启动命令（cmd 批处理或 exe）并取完整路径
    $openclawCmd = "openclaw"
    $g = Get-Command openclaw -ErrorAction SilentlyContinue
    if ($g -and $g.Source) {
        $openclawCmd = $g.Source
        Write-Host "   openclaw located: $openclawCmd" -ForegroundColor Green
    } else {
        $guess = Join-Path $npmGlobal "openclaw.cmd"
        if (Test-Path $guess) { $openclawCmd = $guess; Write-Host "   openclaw located: $guess" -ForegroundColor Green }
        else { Write-Host "   WARNING: could not locate openclaw command." -ForegroundColor Yellow }
    }

    # 2) 用模板生成 ZierClaw.vbs（把 __OPENCLAW__ 占位符替换为绝对路径）
    $launcherDir = Join-Path $env:USERPROFILE "ZierClaw"
    if (-not (Test-Path $launcherDir)) { New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null }
    $vbsDst = Join-Path $launcherDir "ZierClaw.vbs"
    $template = Join-Path $PSScriptRoot "ZierClaw-Launcher-Template.vbs"
    if (Test-Path $template) {
        $vbsBody = (Get-Content $template -Raw).Replace("__OPENCLAW__", $openclawCmd)
        Set-Content -Path $vbsDst -Value $vbsBody -Encoding ASCII
        Write-Host "   Launcher script written: $vbsDst" -ForegroundColor Green
    } else {
        Write-Host "   Launcher template not found: $template" -ForegroundColor Yellow
    }

    # 3) 创建桌面快捷方式「ZierClaw」（指向 vbs）
    $desktop = [Environment]::GetFolderPath("Desktop")
    $lnk = Join-Path $desktop "ZierClaw.lnk"
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = "wscript.exe"
    $sc.Arguments = [char]34 + $vbsDst + [char]34
    $sc.IconLocation = "shell32.dll,43"
    $sc.Description = "ZierClaw - Open your AI assistant"
    $sc.Save()
    Write-Host "   Desktop shortcut created: ZierClaw" -ForegroundColor Green
} catch {
    Write-Host "   Could not create launcher: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""
Read-Host "Press Enter to exit"
