param(
    [string]$SourceDir = $env:E7_WIKI_DATA_DIR
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
if ([string]::IsNullOrWhiteSpace($SourceDir)) {
    $SourceDir = Join-Path (Split-Path -Parent $projectDir) 'epic7-wiki-data'
}
$sourceDir = [System.IO.Path]::GetFullPath($SourceDir)
$progressPath = Join-Path $sourceDir 'fetch-all-progress.json'
$logPath = Join-Path $projectDir 'library-crawl-sync.log'
$deadline = (Get-Date).AddHours(6)

while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $progressPath) {
        try {
            $progress = Get-Content -LiteralPath $progressPath -Raw | ConvertFrom-Json
            if ($progress.stage -eq 'complete') {
                "$(Get-Date -Format s) crawler complete; rebuilding library data" | Add-Content -LiteralPath $logPath
                $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
                $process = Start-Process -FilePath $npm -ArgumentList @('run', 'library:build', '--', $sourceDir) -WorkingDirectory $projectDir -WindowStyle Hidden -Wait -PassThru
                "$(Get-Date -Format s) library build exit code $($process.ExitCode)" | Add-Content -LiteralPath $logPath
                exit $process.ExitCode
            }
        }
        catch {
            "$(Get-Date -Format s) waiting after progress read error: $($_.Exception.Message)" | Add-Content -LiteralPath $logPath
        }
    }
    Start-Sleep -Seconds 15
}

"$(Get-Date -Format s) timed out waiting for crawler" | Add-Content -LiteralPath $logPath
exit 1
