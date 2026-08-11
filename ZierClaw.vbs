' ZierClaw Launcher - Double-click to open ZierClaw Dashboard
' Correct approach: silently run "openclaw dashboard".
' That command auto-detects the user's configured port, starts the
' gateway if needed, and opens the right Dashboard URL in the browser.
Option Explicit

Dim shell
Set shell = CreateObject("WScript.Shell")

' Run the openclaw CLI dashboard command silently (no black window).
' It detects the correct port/URL automatically for THIS user.
shell.Run "cmd /c start """" /min openclaw dashboard", 0, False
