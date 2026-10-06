param([string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'The Windows .NET Framework C# compiler is required to build the launcher.' }
$nodeVersion = & $NodePath -p 'process.versions.node'
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }
$runtime = Join-Path $appRoot 'runtime'
if (!(Test-Path -LiteralPath (Join-Path $runtime 'laya-model/model.safetensors'))) { throw 'Run scripts/prepare-laya.ps1 first to bundle embedded Laya.' }
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $runtime 'node.exe') -Force
Copy-Item -LiteralPath (Join-Path $appRoot 'packaging\NODE-LICENSE.txt') -Destination (Join-Path $runtime 'LICENSE.txt') -Force
$exe = Join-Path $appRoot 'Clocktower Studio.exe'
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/out:$exe" (Join-Path $appRoot 'packaging\Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
$packageVersion = (Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json).version
$dist = Join-Path $appRoot 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zip = Join-Path $dist "Clocktower-Studio-$packageVersion-windows-x64.zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
if(Test-Path -LiteralPath $zip){Remove-Item -LiteralPath $zip}
$archive=[System.IO.Compression.ZipFile]::Open($zip,[System.IO.Compression.ZipArchiveMode]::Create)
try {
 foreach($directory in @('data','examples','lib','public','schemas','sources','runtime')) {
  Get-ChildItem -LiteralPath (Join-Path $appRoot $directory) -Recurse -File | ForEach-Object {
   $relative=[System.IO.Path]::GetRelativePath($appRoot,$_.FullName).Replace('\','/')
   if($relative -ne 'data/app-settings.json' -and $relative -notmatch '/__pycache__/|/laya-fits\.json$') {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$_.FullName,('Clocktower Studio/'+$relative),[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
   }
  }
 }
 foreach($name in @('Clocktower Studio.exe','server.js','package.json','README.md','THIRD-PARTY-NOTICES.md','config.example.json','start-studio.cmd')) {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $appRoot $name),('Clocktower Studio/'+$name),[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
 }
 $archive.CreateEntry('Clocktower Studio/projects/') | Out-Null
} finally {$archive.Dispose()}
@{ version=$packageVersion; node=$nodeVersion; sha256=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash; file=(Split-Path -Leaf $zip) } | ConvertTo-Json | Set-Content -LiteralPath ($zip + '.json') -Encoding utf8
Write-Output "Executable: $exe"
Write-Output "Portable ZIP: $zip"
