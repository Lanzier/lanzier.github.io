const fs = require('fs');
const f = 'C:/Users/Administrator/.openclaw/workspace/website/install.ps1';
let h = fs.readFileSync(f, 'utf8');

const startMark = '# ============================================================\n# 1) Check / Install Node.js';
const endMark = '# ============================================================\n# 2) Check / Install Git';

const iStart = h.indexOf(startMark);
const iEnd = h.indexOf(endMark);
if (iStart === -1 || iEnd === -1) {
  console.log('标点未找到 iStart=' + iStart + ' iEnd=' + iEnd);
  process.exit(1);
}

const newBlock = `# ============================================================
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
        "C:\\Program Files\\nodejs\\node.exe",
        (Join-Path $env:ProgramFiles "nodejs\\node.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\\nodejs\\node.exe"),
        (Join-Path $env:LOCALAPPDATA "OpenClaw\\deps\\portable-node\\node.exe")
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
                $match = [regex]::Match($dl.Content, 'node-v[\\d.]+-x64\\.msi')
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

`;

h = h.slice(0, iStart) + newBlock + h.slice(iEnd);
fs.writeFileSync(f, h, 'utf8');
console.log('✅ Node 检测段已替换为“合并PATH+多点探测+绝对路径”强化版');
