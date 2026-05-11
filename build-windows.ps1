# build-windows.ps1 — Build the CList desktop launcher for Windows
# Requires: pip install pyinstaller
#           winget install FiloSottile.mkcert  (or: choco install mkcert)
# Run from the project root directory as Administrator (mkcert -install needs it).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- mkcert ---
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Error "mkcert not found. Install it with: winget install FiloSottile.mkcert"
    exit 1
}

$certDir = "certs"
$certFile = "$certDir\127.0.0.1.pem"
$keyFile  = "$certDir\127.0.0.1-key.pem"

if (-not (Test-Path $certFile)) {
    New-Item -ItemType Directory -Force -Path $certDir | Out-Null
    Write-Host "Installing mkcert CA (may prompt for admin privileges)..."
    mkcert -install
    Write-Host "Generating TLS certificate for 127.0.0.1..."
    mkcert -cert-file $certFile -key-file $keyFile 127.0.0.1
    Write-Host "Certificate written to $certDir\"
} else {
    Write-Host "TLS certificate already exists in $certDir\ — skipping generation."
}

# --- PyInstaller ---
pyinstaller `
    --onefile `
    --noconsole `
    --name "CList" `
    --add-data "index.html;." `
    --add-data "callback.html;." `
    --add-data "redirect.html;." `
    --add-data "about.html;." `
    --add-data "js;js" `
    --add-data "css;css" `
    --add-data "assets;assets" `
    --add-data "certs;certs" `
    launcher.py

Write-Host "Build complete. Executable: dist\CList.exe"
