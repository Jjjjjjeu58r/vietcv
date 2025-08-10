# PowerShell helper: double-click to start server then open site
$ErrorActionPreference = 'SilentlyContinue'
$port = 3000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$ErrorActionPreference = 'SilentlyContinue'
$port = 3000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Detect startup mode via env var STARTUP_MODE=1 (skip auto-opening browser)
$startupMode = [bool]($env:STARTUP_MODE)

function Test-Port($p){
  try { (Invoke-WebRequest -Uri "http://localhost:$p/api/reviews" -UseBasicParsing -TimeoutSec 1) | Out-Null; return $true } catch { return $false }
}

# Install dependencies first time (if node_modules missing)
if(-not (Test-Path (Join-Path $root 'node_modules'))){
  Write-Host "Installing dependencies (first run)..." -ForegroundColor Yellow
  npm install | Out-Null
}

if(-not (Test-Port $port)){
  Write-Host "Starting server on port $port..." -ForegroundColor Cyan
  # Use minimized window for npm start
  Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Minimized
  Start-Sleep -Seconds 2
}

$tries=0
while(-not (Test-Port $port) -and $tries -lt 30){
  Start-Sleep -Seconds 1
  $tries++
  Write-Host "Waiting server ($tries)..."
}

if(Test-Port $port){
  if(-not $startupMode){
    Start-Process "http://localhost:$port" | Out-Null
    Write-Host "Opened http://localhost:$port" -ForegroundColor Green
  } else {
    Write-Host "Server running at http://localhost:$port (startup mode, browser not opened)" -ForegroundColor Green
  }
} else {
  Write-Host "Server failed to start." -ForegroundColor Red
}
