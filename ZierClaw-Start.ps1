Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconPath = Join-Path $scriptDir "zierclaw-icon.ico"
$pngPath  = Join-Path $scriptDir "zierclaw-icon.png"

$form = New-Object System.Windows.Forms.Form
$form.Text = "ZierClaw"
$form.Size = New-Object System.Drawing.Size(430, 320)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 24)
$form.ForeColor = [System.Drawing.Color]::White
if (Test-Path $iconPath) { try { $form.Icon = New-Object System.Drawing.Icon($iconPath) } catch {} }

if (Test-Path $pngPath) {
    $logo = New-Object System.Windows.Forms.PictureBox
    try { $logo.Image = [System.Drawing.Image]::FromFile($pngPath) } catch {}
    $logo.SizeMode = "Zoom"
    $logo.Width = 120
    $logo.Height = 120
    $logo.Left = [int](($form.ClientSize.Width - $logo.Width) / 2)
    $logo.Top = 20
    $form.Controls.Add($logo)
}

$title = New-Object System.Windows.Forms.Label
$title.Text = "ZierClaw"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::White
$title.AutoSize = $true
$title.Left = [int](($form.ClientSize.Width - $title.Width) / 2)
$title.Top = 148
$title.TextAlign = "MiddleCenter"
$form.Controls.Add($title)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = "Your AI assistant . Open Dashboard"
$sub.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$sub.ForeColor = [System.Drawing.Color]::FromArgb(165,165,175)
$sub.AutoSize = $true
$sub.Left = [int](($form.ClientSize.Width - $sub.Width) / 2)
$sub.Top = 186
$sub.TextAlign = "MiddleCenter"
$form.Controls.Add($sub)

$btn = New-Object System.Windows.Forms.Button
$btn.Text = "Launch ZierClaw"
$btn.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$btn.BackColor = [System.Drawing.Color]::FromArgb(99, 102, 241)
$btn.ForeColor = [System.Drawing.Color]::White
$btn.FlatStyle = "Flat"
$btn.FlatAppearance.BorderSize = 0
$btn.Width = 200
$btn.Height = 48
$btn.Left = [int](($form.ClientSize.Width - $btn.Width) / 2)
$btn.Top = 222
$form.Controls.Add($btn)

$btn.Add_Click({
    $form.Hide()
    try {
        [System.Diagnostics.Process]::Start("cmd.exe", "/c start `"`" /min openclaw dashboard") | Out-Null
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Launch failed: " + $_.Exception.Message, "ZierClaw") | Out-Null
    }
    Start-Sleep -Milliseconds 900
    $form.Close()
})

$form.Add_Shown({ $form.Activate() })
[System.Windows.Forms.Application]::Run($form)
