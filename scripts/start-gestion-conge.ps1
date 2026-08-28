$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs\node.exe'
$postgresServiceName = 'postgresql-x64-18'
$port = 3000
$url = "http://localhost:$port"

if (-not (Test-Path $nodePath)) {
  throw "Node.js introuvable: $nodePath"
}

$postgres = Get-Service -Name $postgresServiceName -ErrorAction SilentlyContinue
if (-not $postgres) {
  throw "Service PostgreSQL introuvable: $postgresServiceName"
}
if ($postgres.Status -ne 'Running') {
  Start-Service -Name $postgresServiceName
  $postgres.WaitForStatus('Running', '00:00:30')
}

$serverReady = $false
try {
  $probe = Invoke-WebRequest -Uri "$url/login.html" -UseBasicParsing -TimeoutSec 2
  $serverReady = $probe.StatusCode -eq 200
} catch {
  $serverReady = $false
}

if (-not $serverReady) {
  Start-Process -FilePath $nodePath -ArgumentList 'server\index.js' -WorkingDirectory $projectRoot -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    try {
      $probe = Invoke-WebRequest -Uri "$url/login.html" -UseBasicParsing -TimeoutSec 2
      if ($probe.StatusCode -eq 200) { $serverReady = $true; break }
    } catch { }
  }
}

if (-not $serverReady) {
  throw "Le serveur n'a pas repondu sur $url"
}

Start-Process $url
