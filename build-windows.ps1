# build-windows.ps1 — Build the CList desktop launcher for Windows
# Requires: pip install pyinstaller
# Run from the project root directory.
#
# Pass -WithLocalRSS to produce a "CList + LocalRSS" build that bundles a
# local LocalRSS backend (localrss_bundled/) alongside CList. That variant
# also needs: pip install -r requirements-localrss.txt

param(
    [switch]$WithLocalRSS
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$exeName = "CList"
$extraArgs = @()

if ($WithLocalRSS) {
    $exeName = "CList-LocalRSS"
    $extraArgs = @(
        '--add-data', 'localrss_bundled;localrss_bundled',
        '--hidden-import', 'flask',
        '--hidden-import', 'aiohttp',
        '--hidden-import', 'feedparser',
        '--hidden-import', 'clist_server_admin',
        '--hidden-import', 'clist_kvstore_auth'
    )
}

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

python -m PyInstaller `
    --onefile `
    --noconsole `
    --name "$exeName" `
    --add-data "index.html;." `
    --add-data "defaults.js;." `
    --add-data "about.html;." `
    --add-data "privacy.html;." `
    --add-data "callback.html;." `
    --add-data "redirect.html;." `
    --add-data "chat.html;." `
    --add-data "chat-popup.html;." `
    --add-data "desktop.html;." `
    --add-data "desktop-how-it-works.html;." `
    --add-data "js;js" `
    --add-data "css;css" `
    --add-data "assets;assets" `
    --add-data "images;images" `
    --add-data "tools/mkcert.exe;tools" `
    @extraArgs `
    launcher.py

Write-Host "Build complete. Executable: dist\$exeName.exe"
