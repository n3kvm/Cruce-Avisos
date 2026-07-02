$ErrorActionPreference = "Stop"

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
        $name, $value = $_ -split "=", 2
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
    }
}

$env:BACKEND_HOST = "127.0.0.1"
$env:BACKEND_PORT = "8765"

if (-not (Test-Path ".venv")) {
    py -m venv .venv
}

.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe backend_graph.py
