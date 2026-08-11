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

# ============================================================
# 1) Check / Install Node.js
# 合并用户+系统 PATH，并多点探测 node 真实路径（避免“已装却检测不到反复重装”）
# ============================================================
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

function Find-NodeExe {
    # 1) PATH 里找
    $g = Get-Command node -ErrorAction SilentlyContinue
    if ($g -and $g.Source) { return $g.Source }
    # 2) 常见安装路径（含 OpenClaw portable node）
    $cands = @(
        "C:\Program Files\nodejs\node.exe",
        (Join-Path $env:ProgramFiles "nodejs\node.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe"),
        (Join-Path $env:LOCALAPPDATA "OpenClaw\deps\portable-node\node.exe")
    )
    foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

$nodeExe = Find-NodeExe
$nodeOk = $false
if ($nodeExe) {
    try {
        $v = & $nodeExe -v 2>$null
        if ($v) { $nodeOk = $true; Write-Host "   Node.js found at $nodeExe : $v" -ForegroundColor Green }
    } catch {}
}
if (-not $nodeOk) {
    Write-Host "   Node.js not found. Trying to locate it..." -ForegroundColor Yellow

    # 首次找不到时，再全面刷新一次 PATH 后重试
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    $nodeExe = Find-NodeExe
    if ($nodeExe) {
        try { $v = & $nodeExe -v 2>$null; if ($v) { $nodeOk = $true; Write-Host "   Node.js found at $nodeExe : $v" -ForegroundColor Green } } catch {}
    }

    if (-not $nodeOk) {
        Write-Host "   Node.js not installed yet. Installing..." -ForegroundColor Yellow

        # 2a) winget first
        $wingetOk = $false
        try { winget --version 2>$null; $wingetOk = $true } catch {}
        if ($wingetOk) {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
            $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
            $nodeExe = Find-NodeExe
            if ($nodeExe) { try { $v = & $nodeExe -v 2>$null; if ($v) { $nodeOk = $true; Write-Host "   Node.js installed: $v" -ForegroundColor Green } } catch {} }
        }

        # 2b) winget 不可用/失败 -> 下载官方 msi 静默安装
        if (-not $nodeOk) {
            Write-Host "   winget unavailable. Downloading Node.js LTS installer directly..." -ForegroundColor Yellow
            try {
                $msi = Join-Path $env:TEMP "node-lts.msi"
                $dl = Invoke-WebRequest -Uri "https://nodejs.org/dist/latest-v22.x/" -UseBasicParsing -ErrorAction Stop
                $match = [regex]::Match($dl.Content, 'node-v[\d.]+-x64\.msi')
                if ($match.Success -and $match.Value) {
                    $file = $match.Value
                    $nodeUrl = "https://nodejs.org/dist/latest-v22.x/" + $file
                    Write-Host "   Downloading $file ..." -ForegroundColor Cyan
                    Invoke-WebRequest -Uri $nodeUrl -OutFile $msi -UseBasicParsing -ErrorAction Stop
                    Write-Host "   Installing Node.js silently..." -ForegroundColor Cyan
                    $msiArgs = '/i "' + $msi + '" /qn'
                    Start-Process msiexec -ArgumentList $msiArgs -Wait
                    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
                    $nodeExe = Find-NodeExe
                    if ($nodeExe) { try { $v = & $nodeExe -v 2>$null; if ($v) { $nodeOk = $true; Write-Host "   Node.js installed: $v" -ForegroundColor Green } } catch {} }
                } else {
                    Write-Host "   Could not resolve Node download URL." -ForegroundColor Yellow
                }
            } catch {
                Write-Host "   Node auto-install failed: $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        if (-not $nodeOk) {
            Write-Host "   Could not install Node automatically. Install LTS from https://nodejs.org then re-run." -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
}

# 供后续使用的绝对路径（.cmd / node.exe）
$nodeBin = $nodeExe

# ── 确保 Node 满足 OpenClaw 要求（Node 24.15.0+/22.22.3+ 且 SQLite≥3.51.3）──────
# 若现有 Node 不达标，则安装 Node 24 LTS 便携版并加到 PATH，
# 否则 OpenClaw 会想自己装 portable node 而循环失败。
function Test-ZClawNodeVersion ([string]$v) {
    $m = [regex]::Match($v, '^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)')
    if (-not $m.Success) { return $false }
    $ma = [int]$m.Groups["major"].Value; $mi = [int]$m.Groups["minor"].Value; $pa = [int]$m.Groups["patch"].Value
    if ($ma -eq 22) { return ($mi -gt 22 -or ($mi -eq 22 -and $pa -ge 3)) }
    if ($ma -eq 24) { return ($mi -ge 15) }
    if ($ma -eq 25) { return ($mi -ge 9) }
    return ($ma -gt 25)
}

function Test-ZClawSqliteVersion ([string]$v) {
    if ([string]::IsNullOrWhiteSpace($v)) { return $false }
    $m = [regex]::Match($v, '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$')
    if (-not $m.Success) { return $false }
    $ma = [int]$m.Groups["major"].Value; $mi = [int]$m.Groups["minor"].Value; $pa = [int]$m.Groups["patch"].Value
    return ($ma -gt 3 -or ($ma -eq 3 -and ($mi -gt 51 -or ($mi -eq 51 -and $pa -ge 3))))
}

function Get-ZClawSqliteVersion ([string]$nodePath) {
    $probe = 'const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(":memory:"); try { process.stdout.write(String(db.prepare("SELECT sqlite_version() AS version").get().version)); } finally { db.close(); }'
    try {
        $r = ($probe | & $nodePath - 2>$null)
        if ($LASTEXITCODE -ne 0) { return $null }
        return $r
    } catch { return $null }
}

$nodeCompliant = $false
if ($nodeExe) {
    try {
        $nv = & $nodeExe -v 2>$null
        if ($nv -and (Test-ZClawNodeVersion $nv)) {
            $sv = Get-ZClawSqliteVersion $nodeExe
            if (Test-ZClawSqliteVersion $sv) {
                $nodeCompliant = $true
                Write-Host "   Node $nv compliant (SQLite $sv)" -ForegroundColor Green
            } else {
                Write-Host "   Node $nv SQLite ($sv) too old; installing compliant Node 24." -ForegroundColor Yellow
            }
        } else {
            Write-Host "   Node version $nv not supported by OpenClaw." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   Node check error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
if (-not $nodeCompliant) {
    Write-Host "   Current Node ($($nv)) not OpenClaw-compliant; installing Node 24 LTS portable..." -ForegroundColor Yellow
    try {
        $nodeZip = Join-Path $env:TEMP "node24-64.zip"
        $nodeRoot = Join-Path $env:LOCALAPPDATA "ZierClaw-node24"
        $dl = Invoke-WebRequest -Uri "https://nodejs.org/dist/latest-v24.x/" -UseBasicParsing -ErrorAction Stop
        $pm = [regex]::Match($dl.Content, 'node-v[\d.]+-win-x64\.zip')
        if ($pm.Success -and $pm.Value) {
            $nodeName = $pm.Value
            $nodeUrl = "https://nodejs.org/dist/latest-v24.x/" + $nodeName
            Write-Host "   Downloading $nodeName ..." -ForegroundColor Cyan
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing -ErrorAction Stop
            Write-Host "   Extracting portable Node 24..." -ForegroundColor Cyan
            if (Test-Path $nodeRoot) { Remove-Item -Recurse -Force $nodeRoot }
            New-Item -ItemType Directory -Force -Path $nodeRoot | Out-Null
            & tar -xf $nodeZip -C $nodeRoot --strip-components 1
            if (Test-Path (Join-Path $nodeRoot "node.exe")) {
                $env:Path = $nodeRoot + ";" + $env:Path
                # 写入用户 PATH，一劳永逸
                $up = [Environment]::GetEnvironmentVariable("Path","User")
                if ($up -notlike "*" + $nodeRoot + "*") {
                    [Environment]::SetEnvironmentVariable("Path", $nodeRoot + ";" + $up, "User")
                    Write-Host "   Added $nodeRoot to user PATH" -ForegroundColor Green
                }
                $nodeExe = Join-Path $nodeRoot "node.exe"
                $nodeCompliant = $true
                Write-Host "   Node 24 portable installed at $nodeRoot" -ForegroundColor Green
            } else {
                Write-Host "   Node 24 extraction failed (node.exe missing)." -ForegroundColor Yellow
            }
        } else {
            Write-Host "   Could not resolve Node 24 download URL." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   Node 24 install failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    Remove-Item $nodeZip -Force -ErrorAction SilentlyContinue
}
if (-not $nodeCompliant) {
    Write-Host "   Could not obtain an OpenClaw-compliant Node. Install Node.js 24 from https://nodejs.org then re-run." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

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

    # 6c) generate ZierClaw.vbs from template (replace __OPENCLAW__)
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

    # 6d) create desktop shortcut
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
