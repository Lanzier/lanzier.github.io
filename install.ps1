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

# ── 放开 PowerShell 执行策略（避免 openclaw.ps1 被 Restricted 拦截）──────
try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force -ErrorAction Stop
    Write-Host "   ExecutionPolicy set to RemoteSigned (CurrentUser)" -ForegroundColor Green
} catch {
    Write-Host "   Could not set ExecutionPolicy: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""

# ============================================================
# Node.js: 完全交给 OpenClaw 官方安装器处理（它会自检并自装合规 Node）
# ============================================================
Write-Host "   Node.js handled by OpenClaw installer." -ForegroundColor DarkGray
Write-Host ""

# ============================================================
# 2) Check / Install Git (MUST be present before OpenClaw install)
# ============================================================
$gitOk = $false
try { $gv = git --version 2>$null; if ($gv) { $gitOk = $true; Write-Host "   Git found: $gv" -ForegroundColor Green } } catch {}

if (-not $gitOk) {
    Write-Host "   Git not found. Installing..." -ForegroundColor Yellow

    # 2a) winget first
    $winget2Ok = $false
    try { winget --version 2>$null; $winget2Ok = $true } catch {}
    if ($winget2Ok) {
        winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        try { $gv = git --version 2>$null; if ($gv) { $gitOk = $true; Write-Host "   Git installed: $gv" -ForegroundColor Green } } catch {}
    }

    # 2b) winget unavailable/failed -> download Git for Windows installer silently
    if (-not $gitOk) {
        Write-Host "   winget unavailable. Downloading Git for Windows (China mirror first)..." -ForegroundColor Yellow
        $gitExe = Join-Path $env:TEMP "git-setup.exe"
        # 多个镜像源，每个最多重试3次（应对“连接意外关闭”偶发）
        $enc = [uri]::EscapeDataString('Git for Windows 2.55.0(3)')
        $gitMirrors = @(
            ("https://mirror.tuna.tsinghua.edu.cn/github-release/git-for-windows/git/" + $enc + "/Git-2.55.0.3-64-bit.exe"),
            "https://github.com/git-for-windows/git/releases/latest/download/Git-2.55.0.3-64-bit.exe",
            "https://git-scm.com/download/win"
        )
        $gitDlOk = $false
        foreach ($gitUrl in $gitMirrors) {
            if ($gitDlOk) { break }
            for ($attempt = 1; $attempt -le 3; $attempt++) {
                if ($gitDlOk) { break }
                try {
                    Write-Host "   Trying (attempt $attempt/3): $gitUrl" -ForegroundColor Cyan
                    Invoke-WebRequest -Uri $gitUrl -OutFile $gitExe -UseBasicParsing -TimeoutSec 90 -ErrorAction Stop
                    $gitDlOk = (Test-Path $gitExe) -and ((Get-Item $gitExe).Length -gt 1MB)
                    if ($gitDlOk) { Write-Host "   Download OK." -ForegroundColor Green }
                } catch {
                    Write-Host "   Attempt $attempt failed: $($_.Exception.Message)" -ForegroundColor DarkGray
                    if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
                }
            }
        }
        if ($gitDlOk) {
            Write-Host "   Installing Git silently..." -ForegroundColor Cyan
            try {
                Start-Process -FilePath $gitExe -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Wait
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                try { $gv = git --version 2>$null; if ($gv) { $gitOk = $true; Write-Host "   Git installed: $gv" -ForegroundColor Green } } catch {}
            } catch {
                Write-Host "   Git install failed: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "   All download mirrors failed." -ForegroundColor Red
        }
    }

    if (-not $gitOk) {
        Write-Host "   Could not install Git automatically." -ForegroundColor Red
        Write-Host "   Install Git for Windows manually: https://git-scm.com/download/win" -ForegroundColor Yellow
        Write-Host "   then re-run this installer." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# ============================================================
# 3) Check / Install OpenClaw (official installer)
# ============================================================
$ocOk = $false
try { $ochk = Get-Command openclaw -ErrorAction SilentlyContinue; if ($ochk) { $ocOk = $true; Write-Host "   OpenClaw found: $($ochk.Source)" -ForegroundColor Green } } catch {}

if (-not $ocOk) {
    Write-Host "   OpenClaw not found. Installing via official installer..." -ForegroundColor Yellow
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        if ($ocOk) { break }
        try {
            Write-Host "   Downloading & running openclaw installer (attempt $attempt/3)..." -ForegroundColor Cyan
            irm https://openclaw.ai/install.ps1 | iex
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            try { $ochk = Get-Command openclaw -ErrorAction SilentlyContinue; if ($ochk) { $ocOk = $true; Write-Host "   OpenClaw installed: $($ochk.Source)" -ForegroundColor Green } } catch {}
        } catch {
            Write-Host "   Attempt $attempt failed: $($_.Exception.Message)" -ForegroundColor DarkGray
            if ($attempt -lt 3) { Start-Sleep -Seconds 3 }
        }
    }
    if (-not $ocOk) {
        Write-Host "   Could not auto-install OpenClaw after 3 tries." -ForegroundColor Red
        Write-Host "   Please install OpenClaw manually (admin PowerShell):" -ForegroundColor Yellow
        Write-Host "   iwr -useb https://openclaw.ai/install.ps1 | iex" -ForegroundColor White
        Write-Host "   then re-run this installer." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
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

# ============================================================
# 4) Ensure openclaw command usable (refresh PATH + npm global)
# ============================================================
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$npmGlobal = Join-Path $env:APPDATA "npm"
if (Test-Path $npmGlobal) { $env:Path = $npmGlobal + ";" + $env:Path }
$ocChk = Get-Command openclaw -ErrorAction SilentlyContinue
if ($ocChk) { Write-Host "   openclaw ready: $($ocChk.Source)" -ForegroundColor Green }
else { Write-Host "   Warning: openclaw not found on PATH yet." -ForegroundColor Yellow }
Write-Host ""

# ============================================================
# 5) Launch official model setup wizard (pick provider + API key)
# ============================================================
Write-Host "   Launching OpenClaw model setup wizard..." -ForegroundColor Cyan
Write-Host "   (Follow the on-screen prompts to choose your AI provider + API key.)" -ForegroundColor Cyan
Write-Host ""
Start-Sleep -Seconds 1
try {
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
    Write-Host "   Open a NEW PowerShell window and run:  openclaw onboard" -ForegroundColor White
    Write-Host ""
    Write-Host "   Skills: https://lanzier.github.io" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================
# 6) ZierClaw desktop launcher (dynamic openclaw path in vbs)
# ============================================================
Write-Host "   Finalizing ZierClaw launcher..." -ForegroundColor Cyan
Write-Host ""
try {
    # 6a) ensure npm global in user PATH (one-time)
    $npmGlobal = Join-Path $env:APPDATA "npm"
    if (Test-Path $npmGlobal) {
        $userPath = [Environment]::GetEnvironmentVariable("Path","User")
        if ($userPath -notlike "*" + $npmGlobal + "*") {
            [Environment]::SetEnvironmentVariable("Path", $userPath + ";" + $npmGlobal, "User")
            Write-Host "   Added npm global to PATH: $npmGlobal" -ForegroundColor Green
        }
        $env:Path = $npmGlobal + ";" + $env:Path
    }

    # 6b) detect real openclaw command full path
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

    # 6c) copy all launcher files (vbs + start ps1 + icons) to fixed location
    $launcherDir = Join-Path $env:USERPROFILE "ZierClaw"
    if (-not (Test-Path $launcherDir)) { New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null }
    $vbsDst = Join-Path $launcherDir "ZierClaw.vbs"
    $startDst = Join-Path $launcherDir "ZierClaw-Start.ps1"
    $icoDst = Join-Path $launcherDir "zierclaw-icon.ico"
    $pngDst = Join-Path $launcherDir "zierclaw-icon.png"
    foreach ($pair in @(
        @('ZierClaw.vbs', $vbsDst),
        @('ZierClaw-Start.ps1', $startDst),
        @('zierclaw-icon.ico', $icoDst),
        @('zierclaw-icon.png', $pngDst)
    )) {
        $srcF = Join-Path $PSScriptRoot $pair[0]
        if (Test-Path $srcF) { Copy-Item $srcF $pair[1] -Force; Write-Host "   Copied $($pair[0])" -ForegroundColor Green }
    }
    Write-Host "   Launcher files ready in $launcherDir" -ForegroundColor Green

    # 6d) create desktop shortcut -> ZierClaw.vbs (branded launcher window)
    $desktop = [Environment]::GetFolderPath("Desktop")
    $lnk = Join-Path $desktop "ZierClaw.lnk"
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = "wscript.exe"
    $sc.Arguments = [char]34 + $vbsDst + [char]34
    if (Test-Path $icoDst) { $sc.IconLocation = $icoDst + ",0" }
    else { $sc.IconLocation = "shell32.dll,43" }
    $sc.Description = "ZierClaw - Open your AI assistant"
    $sc.Save()
    Write-Host "   Desktop shortcut created: ZierClaw" -ForegroundColor Green
} catch {
    Write-Host "   Could not create launcher: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""
Read-Host "Press Enter to exit"
