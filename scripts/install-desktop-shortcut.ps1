$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $appRoot 'Clocktower Studio.exe'
if (!(Test-Path -LiteralPath $exe)) { throw 'Build the Windows executable first.' }
$desktop = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktop 'Clocktower Studio.lnk'
if (Test-Path -LiteralPath $linkPath) {
    $backupDir = Join-Path $appRoot 'output'
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item -LiteralPath $linkPath -Destination (Join-Path $backupDir ('Clocktower-shortcut-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.lnk'))
}
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($linkPath)
$link.TargetPath = $exe
$link.WorkingDirectory = $appRoot
$link.Description = 'Open Clocktower Studio in your browser'
$link.IconLocation = "$exe,0"
$link.Save()
Write-Output "Desktop shortcut: $linkPath"
