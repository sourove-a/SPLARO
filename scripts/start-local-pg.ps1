# SPLARO local PostgreSQL starter (Windows)
# Uses project-local cluster on port 5433 — avoids conflict with system PG on 5432.
#
# First-time setup (run once in elevated PowerShell if needed):
#   $PG = 'C:\Program Files\PostgreSQL\18\bin'
#   $PGDATA = 'D:\SPLARO-BRAND\.local\pgdata-splaro'   # or repo\.local\pgdata-splaro
#   & $PG\initdb.exe -U postgres -A scram-sha-256 -D $PGDATA --pwfile=path\to\pw.txt
#   Add to postgresql.conf: port = 5433, listen_addresses = '127.0.0.1'
#   & $PG\createdb.exe -U postgres -p 5433 splaro_db
#   & $PG\createdb.exe -U postgres -p 5433 splaro_shadow_db
#
# .env:
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/splaro_db
#   DATABASE_URL_SHADOW=postgresql://postgres:postgres@127.0.0.1:5433/splaro_shadow_db

param(
  [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin',
  [int]$Port = 5433
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$PgData = Join-Path $RepoRoot '.local\pgdata-splaro'
$PgCtl = Join-Path $PgBin 'pg_ctl.exe'
$PgIsReady = Join-Path $PgBin 'pg_isready.exe'

if (-not (Test-Path $PgCtl)) {
  Write-Error "PostgreSQL bin not found at: $PgBin`nInstall PostgreSQL 18 or pass -PgBin."
}

if (-not (Test-Path $PgData)) {
  Write-Host "PGDATA not found: $PgData"
  Write-Host "Run initdb first — see script header comments."
  exit 1
}

& $PgIsReady -h 127.0.0.1 -p $Port -q
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL already running on port $Port"
  exit 0
}

Write-Host "Starting PostgreSQL on port $Port ..."
& $PgCtl -D $PgData -l (Join-Path $PgData 'postgresql.log') start

Start-Sleep -Seconds 2
& $PgIsReady -h 127.0.0.1 -p $Port -q
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL ready on 127.0.0.1:$Port"
} else {
  Write-Error "PostgreSQL failed to start. Check $PgData\postgresql.log"
}
