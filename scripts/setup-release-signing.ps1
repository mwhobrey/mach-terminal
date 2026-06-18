# Generate Tauri updater signing keys and upload GitHub Actions secrets.
# Keys live OUTSIDE the repo: %USERPROFILE%\.machbox\mach-terminal-signing\
#
# Usage:
#   .\scripts\setup-release-signing.ps1              # generate + upload
#   .\scripts\setup-release-signing.ps1 -UploadOnly    # upload existing keys
#   .\scripts\setup-release-signing.ps1 -Force         # regenerate (breaks existing updater trust)

param(
    [switch]$UploadOnly,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$Repo = "MachBox-Dev/mach-terminal"
$KeyDir = Join-Path $env:USERPROFILE ".machbox\mach-terminal-signing"
$KeyPath = Join-Path $KeyDir "mach-terminal.key"
$PubPath = "$KeyPath.pub"

function Require-Gh {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw "GitHub CLI (gh) is required. Install from https://cli.github.com and run gh auth login."
    }
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "gh is not authenticated. Run: gh auth login"
    }
}

function Read-SigningPassword {
    $secure = Read-Host "Signing key password (saved as TAURI_SIGNING_PRIVATE_KEY_PASSWORD — store in your password manager)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

Require-Gh

if (-not $UploadOnly) {
    New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null

    if ((Test-Path $KeyPath) -and -not $Force) {
        Write-Host ""
        Write-Host "Keys already exist at:" -ForegroundColor Yellow
        Write-Host "  $KeyPath"
        Write-Host "Use -UploadOnly to push secrets, or -Force to regenerate (INVALIDATES updater for existing installs)." -ForegroundColor Yellow
        exit 1
    }

    if ($Force -and (Test-Path $KeyPath)) {
        Write-Host "WARNING: Regenerating keys. Any published build signed with the old key will NOT accept updates." -ForegroundColor Red
        $confirm = Read-Host "Type REGENERATE to continue"
        if ($confirm -ne "REGENERATE") {
            Write-Host "Aborted."
            exit 1
        }
    }

    $password = Read-SigningPassword

    Write-Host ""
    Write-Host "Generating updater signing keypair..." -ForegroundColor Cyan
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        npm run tauri -- signer generate --ci -w $KeyPath -p $password -f
        if ($LASTEXITCODE -ne 0) {
            throw "tauri signer generate failed"
        }
    } finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "Keypair written to $KeyDir" -ForegroundColor Green
    Write-Host "Back up mach-terminal.key offline. If you lose key + password, updates stop working." -ForegroundColor Yellow
} else {
    if (-not (Test-Path $KeyPath)) {
        throw "No key at $KeyPath — run without -UploadOnly first."
    }
    $password = Read-SigningPassword
}

if (-not (Test-Path $PubPath)) {
    throw "Missing public key: $PubPath"
}

$privateKey = Get-Content -Path $KeyPath -Raw
$publicKey = Get-Content -Path $PubPath -Raw

if ([string]::IsNullOrWhiteSpace($privateKey) -or [string]::IsNullOrWhiteSpace($publicKey)) {
    throw "Key files are empty"
}

Write-Host ""
Write-Host "Uploading secrets to $Repo ..." -ForegroundColor Cyan

$privateKey | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $Repo
if ($LASTEXITCODE -ne 0) { throw "Failed to set TAURI_SIGNING_PRIVATE_KEY" }

$password | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $Repo
if ($LASTEXITCODE -ne 0) { throw "Failed to set TAURI_SIGNING_PRIVATE_KEY_PASSWORD" }

$publicKey | gh secret set UPDATER_PUBLIC_KEY --repo $Repo
if ($LASTEXITCODE -ne 0) { throw "Failed to set UPDATER_PUBLIC_KEY" }

Write-Host ""
Write-Host "Done. Secrets on $Repo :" -ForegroundColor Green
gh secret list --repo $Repo

Write-Host ""
Write-Host "Next: tag an RC to smoke-test release.yml, then stable v0.1.0. See docs/signing-setup.md" -ForegroundColor Cyan
