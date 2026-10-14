param([int]$TaskAppProcessId, [string]$Executable)
$process = Get-Process -Id $TaskAppProcessId -ErrorAction SilentlyContinue
if ($process) {
    if ($process.Path -ne $Executable) { throw 'Smoke-test process identity changed' }
    Stop-Process -Id $TaskAppProcessId -Force
}
