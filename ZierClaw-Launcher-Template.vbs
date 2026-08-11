' ZierClaw Dashboard Launcher
Option Explicit

Dim shell
Set shell = CreateObject("WScript.Shell")

' Launch the OpenClaw dashboard (each user's own port is auto-detected).
shell.Run "cmd /c start """" /min ""__OPENCLAW__"" dashboard", 0, False
