param(
  [string]$SourceRoot = (Join-Path $PSScriptRoot '..\..\e7-tools')
)

$ErrorActionPreference = 'Stop'
$TargetRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SourceRoot = (Resolve-Path $SourceRoot).Path

# Only calculator/build-page code belongs in this repository. App routes, encyclopedia
# pages, editor pages, crawler scripts, and e7-tools packaging files are intentionally
# excluded from this allowlist.
$calculatorFiles = @(
  'src\app\models\artifact.ts',
  'src\app\models\forms.ts',
  'src\app\models\hero.ts',
  'src\app\models\skill.ts',
  'src\assets\i18n\cn.json',
  'src\assets\i18n\us.json',
  'src\data\aliases.json',
  'src\data\catalog.ts',
  'src\data\profiles.ts',
  'src\data\recents.ts',
  'src\CalculatorWorkspace.tsx'
)

$calculatorDirectories = @(
  'src\assets\data',
  'src\calc',
  'src\features\build-presets',
  'src\features\calculator',
  'src\features\defender-effects',
  'src\library',
  'public\library'
)

foreach ($relativePath in $calculatorFiles) {
  $source = Join-Path $SourceRoot $relativePath
  $target = Join-Path $TargetRoot $relativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing source file: $source"
  }
  $targetDirectory = Split-Path -Parent $target
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
  Write-Host "Synced $relativePath"
}

foreach ($relativePath in $calculatorDirectories) {
  $source = Join-Path $SourceRoot $relativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing source directory: $source"
  }
  $target = Join-Path $TargetRoot $relativePath
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
  Write-Host "Synced $relativePath"
}

# Calculator and build pages need hero, skill, buff and artifact images. Preserve
# the desktop-only OCR payload and updater shell by excluding the OCR directory.
$assetSource = Join-Path $SourceRoot 'public\assets'
$assetTarget = Join-Path $TargetRoot 'public\assets'
robocopy $assetSource $assetTarget /E /XD (Join-Path $assetSource 'ocr') /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "Asset sync failed with robocopy exit code $LASTEXITCODE"
}
Write-Host 'Synced public\assets (desktop OCR preserved)'

& node (Join-Path $PSScriptRoot 'prune-calculator-artworks.mjs')
if ($LASTEXITCODE -ne 0) {
  throw 'Calculator artwork pruning failed'
}

Write-Host "Calculator-only sync completed from $SourceRoot"
