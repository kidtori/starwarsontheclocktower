param(
 [string]$PythonPath = (Get-Command python.exe -ErrorAction Stop).Source,
 [string]$SitePackages,
 [string]$ModelPath
)
$ErrorActionPreference='Stop'
$appRoot=Split-Path -Parent $PSScriptRoot
$destination=Join-Path $appRoot 'runtime\python'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$pythonRoot=Split-Path -Parent $PythonPath
foreach($name in @('python.exe','pythonw.exe','python3.dll','python312.dll','vcruntime140.dll','vcruntime140_1.dll','LICENSE.txt','DLLs')) {
 $source=Join-Path $pythonRoot $name
 if(Test-Path -LiteralPath $source){Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force}
}
New-Item -ItemType Directory -Force -Path (Join-Path $destination 'Lib') | Out-Null
Get-ChildItem -LiteralPath (Join-Path $pythonRoot 'Lib') | Where-Object {$_.Name -ne 'site-packages'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $destination 'Lib') -Recurse -Force}
$packages=Join-Path $destination 'Lib\site-packages'
if($SitePackages){Copy-Item -LiteralPath $SitePackages -Destination $packages -Recurse -Force}
else {
 & $PythonPath -m pip install --target $packages 'laya==0.3.6' 'transformers>=4.48,<6' 'torch>=2.5' --extra-index-url https://download.pytorch.org/whl/cpu
 if($LASTEXITCODE -ne 0){throw 'Laya dependencies installation failed.'}
}
$modelDestination=Join-Path $appRoot 'runtime\laya-model'
if($ModelPath){Copy-Item -LiteralPath $ModelPath -Destination $modelDestination -Recurse -Force}
else {
 $env:PYTHONPATH=$packages
 & $PythonPath -c "from huggingface_hub import snapshot_download; snapshot_download('convaiinnovations/laya',revision='5e7b2b1b8ca2ecdd3f2322d94069c9b6ce7e844b',local_dir=r'$modelDestination',allow_patterns=['model.safetensors','rl_agent_config.json','encoder/*','tokenizer/*','LICENSE*','README.md'])"
 if($LASTEXITCODE -ne 0){throw 'Laya model download failed.'}
}
Copy-Item -LiteralPath (Join-Path $appRoot 'packaging\LAYA-LICENSE.txt') -Destination (Join-Path $modelDestination 'LICENSE.txt') -Force
Write-Output 'Embedded Laya runtime prepared.'
