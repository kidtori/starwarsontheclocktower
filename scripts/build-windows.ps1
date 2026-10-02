param([string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is required to build the launcher.' }
$nodeVersion = & $NodePath -p 'process.versions.node'
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }
$runtime = Join-Path $appRoot 'runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $runtime 'node.exe') -Force
Copy-Item -LiteralPath (Join-Path $appRoot 'packaging\NODE-LICENSE.txt') -Destination (Join-Path $runtime 'LICENSE.txt') -Force
$exe = Join-Path $appRoot 'Clocktower Studio.exe'
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$exe" (Join-Path $appRoot 'packaging\Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
$packageVersion = (Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json).version
$dist = Join-Path $appRoot 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$staging = Join-Path $dist ('build-' + [guid]::NewGuid().ToString('N'))
$bundle = Join-Path $staging 'Clocktower Studio'
New-Item -ItemType Directory -Path $bundle | Out-Null
foreach ($name in @('data','examples','lib','public','schemas','sources','runtime')) {
    Copy-Item -LiteralPath (Join-Path $appRoot $name) -Destination (Join-Path $bundle $name) -Recurse
}
$personalSettings = Join-Path $bundle 'data\app-settings.json'
if (Test-Path -LiteralPath $personalSettings) { Remove-Item -LiteralPath $personalSettings }
foreach ($name in @('Clocktower Studio.exe','server.js','package.json','README.md','THIRD-PARTY-NOTICES.md','config.example.json','start-studio.cmd')) {
    Copy-Item -LiteralPath (Join-Path $appRoot $name) -Destination $bundle
}
New-Item -ItemType Directory -Path (Join-Path $bundle 'projects') | Out-Null
$zip = Join-Path $dist "Clocktower-Studio-$packageVersion-windows-x64.zip"
Compress-Archive -LiteralPath $bundle -DestinationPath $zip -Force
@{ version=$packageVersion; node=$nodeVersion; sha256=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash; file=(Split-Path -Leaf $zip) } | ConvertTo-Json | Set-Content -LiteralPath ($zip + '.json') -Encoding utf8
Write-Output "Executable: $exe"
Write-Output "Portable ZIP: $zip"
Write-Output "Staging folder retained: $bundle"
