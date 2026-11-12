$ErrorActionPreference='Stop'
$recordPath=Join-Path (Split-Path $PSScriptRoot -Parent) '.data\logs\processes.json'
if(!(Test-Path -LiteralPath $recordPath)){return}
foreach($record in @(Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json)){
 $process=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
 if($process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$record.started).ToUniversalTime().Ticks){
  & taskkill.exe /PID $record.pid /T /F
 }
}
Remove-Item -LiteralPath $recordPath
Write-Host 'Stopped launcher-owned application servers. The local database remains available.'
