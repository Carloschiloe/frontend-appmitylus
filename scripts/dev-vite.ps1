param(
  [int]$Port = 5173,
  [string]$ServerHost = 'localhost'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Stop-ProjectViteProcesses {
  $targets = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^node(\.exe)?$' -and
    $_.CommandLine -match 'vite(\.js)?' -and
    $_.CommandLine -match [regex]::Escape($projectRoot)
  }

  foreach ($p in $targets) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Host "[dev-vite] stopped vite pid=$($p.ProcessId)"
    } catch {
      Write-Host "[dev-vite] warn could not stop pid=$($p.ProcessId)"
    }
  }
}

function Stop-ProcessByPort([int]$LocalPort) {
  $conns = Get-NetTCPConnection -State Listen -LocalPort $LocalPort -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    if (-not $c.OwningProcess) { continue }
    try {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop
      Write-Host "[dev-vite] stopped pid=$($c.OwningProcess) on port $LocalPort"
    } catch {
      Write-Host "[dev-vite] warn could not stop pid=$($c.OwningProcess) on port $LocalPort"
    }
  }
}

function Wait-UntilPortFree([int]$LocalPort, [int]$TimeoutMs = 5000) {
  $start = Get-Date
  while ($true) {
    $isBusy = Get-NetTCPConnection -State Listen -LocalPort $LocalPort -ErrorAction SilentlyContinue
    if (-not $isBusy) { return $true }
    $elapsed = (Get-Date) - $start
    if ($elapsed.TotalMilliseconds -ge $TimeoutMs) { return $false }
    Start-Sleep -Milliseconds 120
  }
}

Stop-ProjectViteProcesses
Stop-ProcessByPort -LocalPort $Port

if (-not (Wait-UntilPortFree -LocalPort $Port -TimeoutMs 6000)) {
  Write-Error "[dev-vite] port $Port still busy after cleanup."
  exit 1
}

$viteBin = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $viteBin)) {
  Write-Error "[dev-vite] vite not found at $viteBin"
  exit 1
}

Write-Host "[dev-vite] starting vite on http://$($ServerHost):$Port"
& node $viteBin --host $ServerHost --port $Port --strictPort
exit $LASTEXITCODE
