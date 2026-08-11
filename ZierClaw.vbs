' ZierClaw Desktop Launcher - shows a branded start window, then opens Dashboard.
Option Explicit

Dim shell, base, startPs
Set shell = CreateObject("WScript.Shell")
base = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\ZierClaw"
startPs = base & "\ZierClaw-Start.ps1"

' Silently run the branded ZierClaw start window (no black console).
' The start window's button runs "openclaw dashboard" and opens the browser.
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & startPs & """", 0, False
