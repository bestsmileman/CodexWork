param([switch]$Stop, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$manualPidPath = Join-Path $PSScriptRoot 'codex-manual.pid'
$manualServerPath = Join-Path $PSScriptRoot 'codex-manual-server.py'
function Test-Manual {
    try { return (Invoke-RestMethod 'http://127.0.0.1:8787/health' -TimeoutSec 2).service -eq 'codex-file-manual' } catch { return $false }
}
if ($Stop) {
    if (Test-Path -LiteralPath $manualPidPath) {
        $manualProcessId = [int](Get-Content -LiteralPath $manualPidPath -Raw)
        $manualProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $manualProcessId"
        if ($manualProcess -and $manualProcess.CommandLine -like "*$manualServerPath*") {
            Stop-Process -Id $manualProcessId
        }
        Remove-Item -LiteralPath $manualPidPath
    }
    exit
}
if (-not (Test-Manual)) {
    $manualPython = (Get-Command python.exe -ErrorAction Stop).Source
    $manualProcess = Start-Process -FilePath $manualPython -ArgumentList @('"' + $manualServerPath + '"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'codex-manual.stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot 'codex-manual.stderr.log')
    $manualProcess.Id | Set-Content -LiteralPath $manualPidPath
    $manualReady = $false
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        if (Test-Manual) { $manualReady=$true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $manualReady) { throw 'Codex manual could not start on port 8787. Check codex-manual.stderr.log; another app may be using the port.' }
}
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:8787/' }
