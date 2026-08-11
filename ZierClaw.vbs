' ZierClaw Launcher - Double-click to open ZierClaw Dashboard
' Uses the "openclaw" CLI (expected on PATH). No black window.
Option Explicit

Dim shell, port, dashboard, isUp
port = "18789"
dashboard = "http://127.0.0.1:" & port & "/"
Set shell = CreateObject("WScript.Shell")

' 1) Check if gateway is already running (port listening)
isUp = IsPortOpen(port)

' 2) If not running, start it silently via the openclaw CLI
If Not isUp Then
    shell.Run "cmd /c start """" /b openclaw gateway", 0, False
    WScript.Sleep 5000
End If

' 3) Open Dashboard in default browser
shell.Run dashboard, 1, False

' Helper: does the TCP port show as LISTENING?
Function IsPortOpen(p)
    Dim ws, exec, out, found
    Set ws = CreateObject("WScript.Shell")
    found = False
    On Error Resume Next
    Set exec = ws.Exec("netstat -ano -p tcp | findstr """ & p & """")
    Do While Not exec.StdOut.AtEndOfStream
        out = LCase(exec.StdOut.ReadLine)
        If InStr(out, "listening") > 0 Then
            found = True
            Exit Do
        End If
    Loop
    IsPortOpen = found
End Function
