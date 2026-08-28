$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs\node.exe'
$postgresServiceName = 'postgresql-x64-18'
$envFile = Join-Path $projectRoot '.env'
$port = 3000

if (-not (Test-Path $nodePath)) { throw "Node.js introuvable: $nodePath" }
if (-not (Test-Path $envFile)) { throw "Fichier .env introuvable: $envFile" }

$requiredKeys = @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'SESSION_SECRET', 'PORT')
$envText = Get-Content -Raw $envFile
$missingKeys = $requiredKeys | Where-Object { $envText -notmatch "(?m)^$_=" }
if ($missingKeys) { throw "Variables manquantes dans .env: $($missingKeys -join ', ')" }

$postgres = Get-Service -Name $postgresServiceName -ErrorAction SilentlyContinue
if (-not $postgres) { throw "Service PostgreSQL introuvable: $postgresServiceName" }
if ($postgres.Status -ne 'Running') {
  Start-Service -Name $postgresServiceName
  $postgres.WaitForStatus('Running', '00:00:30')
}

$portInUse = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($portInUse) { throw "Le port $port est deja utilise. Arretez l'autre serveur avant de lancer la production." }

$env:NODE_ENV = 'production'
Set-Location $projectRoot
& $nodePath 'server\index.js'
exit $LASTEXITCODE
