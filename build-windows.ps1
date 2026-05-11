# build-windows.ps1 — Build the CList desktop launcher for Windows
# Requires: pip install pyinstaller
# Run from the project root directory.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Download mkcert for Windows (bundled for first-run TLS setup) ──────────────
$toolsDir = Join-Path $PSScriptRoot 'tools'
$mkcertExe = Join-Path $toolsDir 'mkcert.exe'

if (-not (Test-Path $mkcertExe)) {
    Write-Host "Downloading mkcert.exe..."
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/FiloSottile/mkcert/releases/latest'
    $ver = $release.tag_name  # e.g. "v1.4.4"
    $mkcertUrl = "https://github.com/FiloSottile/mkcert/releases/download/$ver/mkcert-$ver-windows-amd64.exe"
    Invoke-WebRequest -Uri $mkcertUrl -OutFile $mkcertExe
    Write-Host "mkcert.exe ($ver) downloaded to tools\"
} else {
    Write-Host "mkcert.exe already present, skipping download."
}

pyinstaller `
    --onefile `
    --noconsole `
    --name "CList" `
    --add-data "index.html;." `
    --add-data "about.html;." `
    --add-data "callback.html;." `
    --add-data "redirect.html;." `
    --add-data "flasker.html;." `
    --add-data "me.html;." `
    --add-data "chat.html;." `
    --add-data "js;js" `
    --add-data "css;css" `
    --add-data "assets;assets" `
    --add-data "tools/mkcert.exe;tools" `
    launcher.py

Write-Host "Build complete. Executable: dist\CList.exe"
