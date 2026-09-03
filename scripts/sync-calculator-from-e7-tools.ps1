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
  'src\app\models\forms.ts',
  'src\app\models\hero.ts',
  'src\assets\data\constants.ts',
  'src\assets\data\heroes.ts',
  'src\assets\data\artifacts.ts',
  'src\assets\data\skill_ids.ts',
  'src\assets\i18n\cn.json',
  'src\assets\i18n\us.json',
  'src\calc\damageEngine.ts',
  'src\data\profiles.ts',
  'src\CalculatorWorkspace.tsx',
  'src\features\calculator\derivedFields.ts',
  'src\features\calculator\mergeCalculatorValues.ts',
  'src\features\calculator\septemberHeroes.test.ts',
  'src\features\calculator\lightAndDarkness.test.ts',
  'src\features\calculator\blackHandCritDamage.test.ts',
  'public\library\heroes.json',
  'public\library\artifacts.json',
  'public\library\presets.json',
  'public\library\manifest.json'
)

$calculatorAssets = @(
  'public\assets\buffs\attack-mission-buff.webp',
  'public\assets\buffs\defense-mission-buff.webp',
  'public\assets\buffs\divinity-buff.webp',
  'public\assets\buffs\indomitable-buff.webp',
  'public\assets\buffs\stellar-knowledge-buff.webp',
  'public\assets\heroes\lisette-icon.png',
  'public\assets\heroes\uncharted_pioneer_politis-icon.png',
  'public\assets\skills\sk_c2186_1.png',
  'public\assets\skills\sk_c2186_2.png',
  'public\assets\skills\sk_c2186_3.png',
  'public\assets\skills\sk_c5112_1.png',
  'public\assets\skills\sk_c5112_2.png',
  'public\assets\skills\sk_c5112_3.png',
  'public\library\heroes\lisette.webp',
  'public\library\heroes\lisette-avatar.png',
  'public\library\heroes\lisette-sk_c2186_1.png',
  'public\library\heroes\lisette-sk_c2186_2.png',
  'public\library\heroes\lisette-sk_c2186_3.png',
  'public\library\heroes\uncharted-pioneer-politis.webp',
  'public\library\heroes\uncharted-pioneer-politis-avatar.png',
  'public\library\heroes\uncharted-pioneer-politis-sk_c5112_1.png',
  'public\library\heroes\uncharted-pioneer-politis-sk_c5112_2.png',
  'public\library\heroes\uncharted-pioneer-politis-sk_c5112_3.png',
  'public\library\artifacts\light-and-darkness.png',
  'public\library\artifacts\land-of-lingering-light.png',
  'public\library\artifacts\intoxicating-indulgence.png',
  'public\library\artifact-artworks\light-and-darkness.png',
  'public\library\artifact-artworks\land-of-lingering-light.png',
  'public\library\artifact-artworks\intoxicating-indulgence.png'
)

foreach ($relativePath in @($calculatorFiles + $calculatorAssets)) {
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

Write-Host "Calculator-only sync completed from $SourceRoot"
