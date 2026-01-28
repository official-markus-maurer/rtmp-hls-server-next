# PowerShell script to start Node.js RTMP/HLS Server

$ErrorActionPreference = "Stop"

# 1. Check dependencies
$NodeServerDir = Join-Path $PSScriptRoot "node-server"
if (-not (Test-Path "$NodeServerDir\node_modules")) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan
    Set-Location $NodeServerDir
    npm install
}

# 2. Start Server
Write-Host "Starting Node.js Media Server..." -ForegroundColor Green
Write-Host "RTMP: rtmp://localhost:1935/live"
Write-Host "Web/Stats: http://localhost:8080"
Write-Host "Logs will appear below. Press Ctrl+C to stop."

Set-Location $NodeServerDir
node index.js