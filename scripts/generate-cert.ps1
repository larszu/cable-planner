# =============================================================================
# generate-cert.ps1 — Erstellt ein selbst-signiertes Code-Signing-Zertifikat
# für Lars Zumpe und exportiert es als build/code-sign.pfx.
#
# WICHTIG: Ein selbst-signiertes Cert verhindert NICHT die SmartScreen-Warnung
# beim Download. Es sorgt nur dafür, dass im Installer-Header der Aussteller
# korrekt steht und Windows die Datei als „signiert" erkennt. Damit
# SmartScreen ohne Warnung durchwinkt, brauchst du ein EV-Code-Signing-Cert
# einer öffentlichen CA (DigiCert, Sectigo, GlobalSign, ~250-450 EUR/Jahr).
#
# Anwendung:
#   1. PowerShell als Admin öffnen
#   2. Set-ExecutionPolicy -Scope Process Bypass
#   3. .\scripts\generate-cert.ps1 -Password 'meinSicheresPasswort'
#   4. .pfx-Datei landet in build\code-sign.pfx
#   5. Passwort als Umgebungsvariable setzen:
#        $env:CSC_LINK = 'build/code-sign.pfx'
#        $env:CSC_KEY_PASSWORD = 'meinSicheresPasswort'
#   6. npm run dist
# =============================================================================

param(
  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$Subject = 'CN=Lars Zumpe, O=Lars Zumpe, C=DE',

  [string]$OutPath
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrEmpty($OutPath)) {
  $OutPath = Join-Path $scriptDir '..\build\code-sign.pfx'
}

Write-Host "Erstelle selbst-signiertes Code-Signing-Zertifikat ..." -ForegroundColor Cyan
$cert = New-SelfSignedCertificate `
  -Subject $Subject `
  -Type CodeSigningCert `
  -KeySpec Signature `
  -KeyUsage DigitalSignature `
  -KeyExportPolicy Exportable `
  -KeyAlgorithm RSA `
  -KeyLength 4096 `
  -HashAlgorithm SHA256 `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears(5) `
  -FriendlyName 'Cable Planner Code Signing (Lars Zumpe)'

Write-Host ("Thumbprint: " + $cert.Thumbprint) -ForegroundColor Green

$securePwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
$resolvedOut = [System.IO.Path]::GetFullPath($OutPath)
$outDir = Split-Path -Parent $resolvedOut
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

Export-PfxCertificate -Cert "Cert:\CurrentUser\My\$($cert.Thumbprint)" `
  -FilePath $resolvedOut -Password $securePwd | Out-Null

Write-Host ("Exportiert nach: " + $resolvedOut) -ForegroundColor Green
Write-Host ""
Write-Host "Trust-Stammzertifikat installieren (einmalig auf eigenen Rechnern), damit Windows den" -ForegroundColor Yellow
Write-Host "Aussteller als bekannt markiert (auf fremden PCs hilft das natuerlich nicht):" -ForegroundColor Yellow
Write-Host "  Import-Certificate -FilePath build\code-sign.cer -CertStoreLocation Cert:\LocalMachine\Root" -ForegroundColor Yellow
Write-Host ""
Write-Host "Naechste Schritte:" -ForegroundColor Cyan
Write-Host '  $env:CSC_LINK = "build/code-sign.pfx"'
Write-Host '  $env:CSC_KEY_PASSWORD = "<dein Passwort>"'
Write-Host '  npm run dist'
