$ErrorActionPreference = "Stop"

$TaskName = "Sincronizar Soportes Espejo cada 2 horas"
$ScriptPath = "D:\OneDrive - BRILLASEO SAS\PROYECTOS\cruce-avisos-github\scripts\sincronizar_soportes_espejo.ps1"

if (-not (Test-Path -LiteralPath $ScriptPath)) {
    throw "No existe el script: $ScriptPath"
}

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Copia soportes desde COMFANDI hacia SharePoint espejo cada 2 horas." -Force | Out-Null

Write-Host "Tarea programada creada/actualizada:" -ForegroundColor Green
Write-Host $TaskName
Write-Host "Script:" $ScriptPath
Write-Host "Frecuencia: cada 2 horas"
