param([switch]$Stop,[switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$maruRoot = Split-Path -Parent $PSCommandPath
$maruUrl = 'http://127.0.0.1:4317'
try {
    $maruRunning = $false
    try {
        $maruHealth = Invoke-RestMethod -Uri "$maruUrl/api/health" -TimeoutSec 2
        $maruRunning = $maruHealth.app -eq 'maru-chat-studio'
    } catch {}
    if ($Stop) {
        if (-not $maruRunning) { Write-Host 'Maru is not running.'; exit 0 }
        $null = Invoke-WebRequest -Uri "$maruUrl/api/session" -UseBasicParsing -SessionVariable maruSession
        $null = Invoke-RestMethod -Uri "$maruUrl/api/shutdown" -Method Post -WebSession $maruSession -ContentType 'application/json' -Body '{}'
        Write-Host 'Maru stopped. Your Codex app is unchanged.'
        exit 0
    }
    if (-not $maruRunning) {
        $maruNode = (Get-Command node.exe -ErrorAction Stop).Source
        $maruData = Join-Path $maruRoot '.maru'
        $null = New-Item -ItemType Directory -Force -Path $maruData
        $maruServer = Join-Path $maruRoot 'server.cjs'
        $maruProcess = Start-Process -FilePath $maruNode -ArgumentList ('"' + $maruServer + '"') -WorkingDirectory $maruRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $maruData 'server.log') -RedirectStandardError (Join-Path $maruData 'server-error.log') -PassThru
        for ($maruAttempt = 0; $maruAttempt -lt 60; $maruAttempt++) {
            Start-Sleep -Milliseconds 200
            try {
                $maruHealth = Invoke-RestMethod -Uri "$maruUrl/api/health" -TimeoutSec 1
                if ($maruHealth.app -eq 'maru-chat-studio') { $maruRunning = $true; break }
            } catch {}
            if ($maruProcess.HasExited) { break }
        }
        if (-not $maruRunning) { throw "Maru could not start. See $maruData\server-error.log" }
    }
    if (-not $NoBrowser) { Start-Process $maruUrl }
    Write-Host "Maru is ready: $maruUrl"
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
