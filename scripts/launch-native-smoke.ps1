param([string]$Executable, [string]$DataFolder, [int]$DebugPort)
$ErrorActionPreference = 'Stop'
$env:WEBVIEW2_USER_DATA_FOLDER = $DataFolder
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$DebugPort --remote-debugging-address=127.0.0.1"
$process = Start-Process -FilePath $Executable -WorkingDirectory (Split-Path -Parent $Executable) -WindowStyle Hidden -PassThru
Write-Output $process.Id
