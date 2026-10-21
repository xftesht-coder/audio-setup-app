$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$localAgentDirectory = Join-Path $projectDirectory '.audio-agent'
New-Item -ItemType Directory -Path $localAgentDirectory -Force | Out-Null
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$env:AUDIO_CODEX_BIN = (Get-Command codex -ErrorAction Stop).Source
$agentScript = Join-Path $PSScriptRoot 'agent-server.mjs'
$health = $null
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5188/__agent/health' -TimeoutSec 2
} catch { }
if ($health.service -eq 'audio-setup-agent') {
    if ($health.state -ne 'unavailable') {
        Write-Output 'Audio Setup Agent is already running: http://127.0.0.1:5188/connect'
        exit 0
    }
    # Restart only our recorded Node server, never an arbitrary process using the port.
    $connection = Get-Content -LiteralPath (Join-Path $localAgentDirectory 'connection.json') -Raw | ConvertFrom-Json
    $agentProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$connection.pid)
    if (!$agentProcess -or $agentProcess.Name -ne 'node.exe' -or !$agentProcess.CommandLine.Contains($agentScript)) {
        throw 'Cannot safely identify Audio Setup Agent. Close its process manually before restarting.'
    }
    Stop-Process -Id $agentProcess.ProcessId -ErrorAction Stop
    Wait-Process -Id $agentProcess.ProcessId -ErrorAction SilentlyContinue
}
Start-Process -FilePath $nodeExecutable -ArgumentList @(('"' + $agentScript + '"')) -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localAgentDirectory 'server.log') -RedirectStandardError (Join-Path $localAgentDirectory 'server-error.log') | Out-Null
Write-Output 'Starting Audio Setup Agent: http://127.0.0.1:5188/connect'
