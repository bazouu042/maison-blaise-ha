<#
  Applique (ou retire) le PATCH STT LOCAL dans app.js — idempotent.
    .\apply_stt_patch.ps1 -AppJs "C:\chemin\vers\app.js"            # applique
    .\apply_stt_patch.ps1 -AppJs "C:\chemin\vers\app.js" -Remove    # retire
  -Patch : chemin de local_stt_patch.js (par défaut : à côté de ce script)
#>
param(
  [Parameter(Mandatory = $true)][string]$AppJs,
  [string]$Patch = (Join-Path $PSScriptRoot 'local_stt_patch.js'),
  [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$src = [IO.File]::ReadAllText($AppJs, $utf8)

$guard = "if (window.LOCAL_STT && window.LOCAL_STT.enabled) { return window.LOCAL_STT.start(); } // PATCH STT LOCAL"
$blockRx = '(?s)\r?\n?/\* PATCH STT LOCAL - DEBUT.*?/\* PATCH STT LOCAL - FIN =+ \*/\r?\n?'
$guardRx = '[ \t]*if \(window\.LOCAL_STT && window\.LOCAL_STT\.enabled\) \{ return window\.LOCAL_STT\.start\(\); \} // PATCH STT LOCAL\r?\n'

# On retire toujours l'ancienne version (=> ré-appliquer met à jour le bloc)
$out = [regex]::Replace($src, $blockRx, "`n")
$out = [regex]::Replace($out, $guardRx, '')

if (-not $Remove) {
  # Formes reconnues : function startSpeechListening(...) {   |   startSpeechListening = function(...) {   |   = (...) => {
  $fnRx = '((?:async\s+)?function\s+startSpeechListening\s*\([^)]*\)\s*\{|startSpeechListening\s*=\s*(?:async\s*)?(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{)[ \t]*\r?\n'
  $m = [regex]::Matches($out, $fnRx)
  if ($m.Count -ne 1) { throw "startSpeechListening trouvee $($m.Count) fois (attendu : 1). Insere la ligne garde a la main." }
  $nl = if ($out.Contains("`r`n")) { "`r`n" } else { "`n" }
  $at = $m[0].Index + $m[0].Length
  $out = $out.Insert($at, "  $guard$nl")
  $block = [IO.File]::ReadAllText($Patch, $utf8)
  $out = $out.TrimEnd() + $nl + $nl + $block.Trim() + $nl
  $ligne = ($out.Substring(0, $at) -split "`n").Count
  Write-Host "Ligne garde inseree ligne $ligne, bloc ajoute en fin de fichier."
} else {
  Write-Host "Patch retire."
}

if ($out -ne $src) {
  Copy-Item $AppJs "$AppJs.bak-stt" -Force
  [IO.File]::WriteAllText($AppJs, $out, $utf8)
  Write-Host "app.js ecrit (copie : $AppJs.bak-stt)."
} else {
  Write-Host "Aucun changement."
}
