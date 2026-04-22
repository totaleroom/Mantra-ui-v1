# =============================================================
# Mantra AI — one-shot .env generator (PowerShell version)
#
# Windows-native equivalent of scripts/generate-env.sh.
# Generates all required secrets via .NET RNGCryptoServiceProvider
# (no openssl dependency) and writes them to .env.
#
# Usage (PowerShell):
#   .\scripts\generate-env.ps1 -PublicUrl http://localhost:5000
#   .\scripts\generate-env.ps1 -PublicUrl https://mantra.yourdomain.com -Write
#   .\scripts\generate-env.ps1 -EvoKey "existing-key" -Write
# =============================================================

param(
    [string]$PublicUrl = "http://localhost:5000",
    [string]$EvoKey    = "",
    [switch]$Write
)

function New-RandomBase64 {
    param([int]$Bytes = 32)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    # Base64URL-safe: strip padding, replace +/
    return ([Convert]::ToBase64String($buf)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-RandomHex {
    param([int]$Bytes = 16)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return -join ($buf | ForEach-Object { $_.ToString("x2") })
}

$JwtSecret        = New-RandomBase64 48
$WebhookSecret    = New-RandomBase64 32
$PostgresPassword = New-RandomBase64 24
$HermesToken      = New-RandomHex 24

$EvoGenerated = $false
if ([string]::IsNullOrWhiteSpace($EvoKey)) {
    $EvoKey = New-RandomBase64 32
    $EvoGenerated = $true
}

$WsUrl = $PublicUrl -replace '^http', 'ws'

$Content = @"
# --- Core secrets (generated $([DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"))) ---
JWT_SECRET=$JwtSecret
WEBHOOK_SECRET=$WebhookSecret
POSTGRES_PASSWORD=$PostgresPassword
HERMES_AUTH_TOKEN=$HermesToken

# --- PostgreSQL ---
POSTGRES_USER=mantra
POSTGRES_DB=mantra_db
DATABASE_URL=postgres://mantra:$PostgresPassword@postgres:5432/mantra_db?sslmode=disable

# --- Redis ---
REDIS_URL=redis://redis:6379

# --- Evolution (WhatsApp gateway) ---
EVO_API_KEY=$EvoKey
EVO_API_URL=http://evolution:8080
EVOLUTION_SERVER_URL=$PublicUrl`:8080
NEXT_PUBLIC_EVO_URL=$PublicUrl`:8080
NEXT_PUBLIC_EVO_INSTANCE_NAME=mantra_instance

# --- Public URLs ---
PUBLIC_BACKEND_URL=$PublicUrl
BACKEND_INTERNAL_URL=http://backend:3001
FRONTEND_URL=$PublicUrl
NEXT_PUBLIC_API_URL=$PublicUrl
NEXT_PUBLIC_WS_URL=$WsUrl
NEXT_PUBLIC_BACKEND_URL=$PublicUrl
NEXT_PUBLIC_BASE_URL=$PublicUrl

# --- Runtime ---
APP_ENV=production
NODE_ENV=production
"@

if ($Write) {
    if (Test-Path .env) {
        $backup = ".env.backup." + (Get-Date -Format "yyyyMMdd-HHmmss")
        Copy-Item .env $backup
        Write-Host "[env] existing .env backed up to $backup"
    }
    Set-Content -Path .env -Value $Content -Encoding UTF8
    Write-Host "[env] wrote .env" -ForegroundColor Green
} else {
    Write-Output $Content
}

if ($EvoGenerated) {
    Write-Host ""
    Write-Host "WARN: Evolution API key was auto-generated. The Evolution container" -ForegroundColor Yellow
    Write-Host "      will accept this only if you're running the bundled instance." -ForegroundColor Yellow
    Write-Host "      If you BYO Evolution, re-run with -EvoKey <existing-key>." -ForegroundColor Yellow
}
