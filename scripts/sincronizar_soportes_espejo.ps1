$ErrorActionPreference = "Stop"

$Source = "D:\COMFANDI\Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez"
$Destination = "D:\OneDrive - BRILLASEO SAS\Soportes Espejo - Documentos\Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez"
$LogDir = "D:\OneDrive - BRILLASEO SAS\PROYECTOS\cruce-avisos-github\logs"
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $LogDir "sync_soportes_$Stamp.log"

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (-not (Test-Path -LiteralPath $Source)) {
    throw "No existe la carpeta origen: $Source"
}

Write-Host "Sincronizando soportes..." -ForegroundColor Cyan
Write-Host "Origen:  $Source"
Write-Host "Destino: $Destination"
Write-Host "Log:     $LogFile"

$arguments = @(
    $Source,
    $Destination,
    "/E",          # Copia subcarpetas, incluidas vacias.
    "/Z",          # Modo reiniciable.
    "/FFT",        # Tolerancia de tiempos para OneDrive/SharePoint.
    "/IT",         # Incluye archivos existentes con cambios de atributos/metadatos.
    "/R:2",        # Reintentos por archivo.
    "/W:5",        # Espera entre reintentos.
    "/COPY:DAT",   # Datos, atributos y fechas.
    "/DCOPY:DAT",  # Datos, atributos y fechas de carpetas.
    "/XA:SH",      # Excluye archivos de sistema/ocultos.
    "/XF", "~$*", ".*.tmp", "*.tmp",
    "/TEE",
    "/LOG:$LogFile"
)

& robocopy @arguments
$code = $LASTEXITCODE

# Robocopy usa 0-7 como estados correctos/informativos.
if ($code -le 7) {
    Write-Host "Sincronizacion completada. Codigo Robocopy: $code" -ForegroundColor Green
    Write-Host "Generando indice_avisos.json..." -ForegroundColor Cyan

    $IndexScript = "D:\OneDrive - BRILLASEO SAS\PROYECTOS\cruce-avisos-github\scripts\generar_indice_soportes.py"
    $PythonCandidates = @(
        "python",
        "py",
        "C:\Users\DELL\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    )
    $Python = $null
    foreach ($Candidate in $PythonCandidates) {
        try {
            if ($Candidate -in @("python", "py")) {
                $cmd = Get-Command $Candidate -ErrorAction Stop
                $Python = $cmd.Source
            } elseif (Test-Path -LiteralPath $Candidate) {
                $Python = $Candidate
            }
            if ($Python) { break }
        } catch { }
    }
    if (-not $Python) {
        throw "No encontre Python para generar el indice. Instala Python o ajusta la ruta en el script."
    }

    & $Python $IndexScript --folder $Destination --output (Join-Path $Destination "indice_avisos.json")
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo la generacion de indice_avisos.json"
    }
    Write-Host "Indice generado correctamente." -ForegroundColor Green
    exit 0
}

Write-Host "Sincronizacion con errores. Codigo Robocopy: $code" -ForegroundColor Red
exit $code



