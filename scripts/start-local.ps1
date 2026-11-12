param([switch]$PreviewOnly)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
$nodePath=if($nodeCommand){$nodeCommand.Source}else{Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){throw 'Install Node.js 22 or newer.'}
$env:Path=(Split-Path $nodePath -Parent)+';'+$env:Path
$logDir=Join-Path $projectRoot '.data\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$recordPath=Join-Path $logDir 'processes.json'
$records=@()
if(Test-Path -LiteralPath $recordPath){$records=@(Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json)}
$addresses=@(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*'} | Select-Object -ExpandProperty IPAddress)
$origins=@('http://localhost:8082','http://localhost:8081','http://localhost:4173','http://127.0.0.1:4173')
foreach($address in $addresses){$origins+=('http://'+$address+':8082');$origins+=('http://'+$address+':4173')}
$env:CORS_ORIGINS=$origins -join ','
function Launch-Service($name,$port,$arguments,$directory){
 if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){Write-Host "$name already listening on $port";return}
 $process=Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "$name.log") -RedirectStandardError (Join-Path $logDir "$name.err.log") -PassThru
 $script:records+=@{name=$name;pid=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')}
 Write-Host "Started $name ($($process.Id))"
}
$apiEnvPath=Join-Path $projectRoot 'apps\api\.env'
$databaseUrl=$env:DATABASE_URL
if(!$databaseUrl -and (Test-Path -LiteralPath $apiEnvPath)){
 $databaseLine=Get-Content -LiteralPath $apiEnvPath | Where-Object {$_ -match '^DATABASE_URL='} | Select-Object -First 1
 if($databaseLine){$databaseUrl=($databaseLine -replace '^DATABASE_URL=','').Trim().Trim('"').Trim("'")}
}
$usesLocalDatabase=$databaseUrl -and ([uri]$databaseUrl).Host -in @('localhost','127.0.0.1') -and ([uri]$databaseUrl).Port -eq 55432
if($usesLocalDatabase -and !(Get-NetTCPConnection -State Listen -LocalPort 55432 -ErrorAction SilentlyContinue)){
 & 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D (Join-Path $projectRoot '.data\postgres') -l (Join-Path $logDir 'postgres.log') -o '-p 55432 -h 127.0.0.1' start
 if($LASTEXITCODE -ne 0){throw 'PostgreSQL failed to start.'}
}
Launch-Service 'api' 4000 'node_modules/tsx/dist/cli.mjs apps/api/src/server.ts' $projectRoot
Launch-Service 'preview' 4173 'scripts/serve-web.mjs' $projectRoot
if(!$PreviewOnly){
 Launch-Service 'expo' 8081 '../../node_modules/expo/bin/cli start --lan --port 8081' (Join-Path $projectRoot 'apps\mobile')
 Launch-Service 'web' 8082 '../../node_modules/expo/bin/cli start --web --port 8082' (Join-Path $projectRoot 'apps\mobile')
}
$records | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $recordPath
Write-Host 'Web: http://localhost:8082 | Offline preview: http://localhost:4173'
foreach($address in $addresses){Write-Host ('Phone Expo: exp://'+$address+':8081')}
