# Levanta Student en local: dependencias, (opcional) voz e imágenes que falten, y servidor de desarrollo.
#
#   .\dev.ps1            instala si hace falta y arranca Vite en http://localhost:5199/student/
#   .\dev.ps1 -Assets    antes genera la voz y las imágenes que falten (GPU, puede tardar)
#   .\dev.ps1 -Lan       además lo expone en la red local, para abrirlo desde el móvil
param(
  [switch]$Assets,
  [switch]$Lan
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path node_modules)) {
  Write-Host '> npm install' -ForegroundColor Yellow
  npm install
  if (-not $?) { exit 1 }
}

if ($Assets) {
  # En serie: voz e imágenes comparten la GPU.
  Write-Host '> npm run tts' -ForegroundColor Yellow
  npm run tts
  if (-not $?) { exit 1 }
  Write-Host '> npm run images' -ForegroundColor Yellow
  npm run images
  if (-not $?) { exit 1 }
}

$url = 'http://localhost:5199/student/#/feed'
Write-Host "> vite  $url" -ForegroundColor Yellow
Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 2; Start-Process $u } -ArgumentList $url | Out-Null

$viteArgs = @('vite', '--port', '5199', '--strictPort')
if ($Lan) { $viteArgs += '--host' }
npx @viteArgs
