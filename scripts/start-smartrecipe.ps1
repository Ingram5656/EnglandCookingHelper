param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BackendRoot = Join-Path $ProjectRoot "backend"
$VenvRoot = Join-Path $BackendRoot ".venv"
$VenvPython = Join-Path $VenvRoot "Scripts\python.exe"
$RequirementsFile = Join-Path $BackendRoot "requirements.txt"
$BackendUrl = "http://127.0.0.1:8000"
$FrontendUrl = "http://127.0.0.1:5173"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Green
}

function Quote-ForPowerShell([string]$Value) {
  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-RequiredCommand([string[]]$Names, [string]$InstallHint) {
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
      return $command.Source
    }
  }
  throw $InstallHint
}

function Get-FrontendRunner() {
  $systemPnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $systemPnpm) {
    $systemPnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if ($systemPnpm) {
    return @{
      Command = $systemPnpm.Source
      PathPrefix = ""
      InstallArgs = @("install")
      DevArgs = @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort")
      Label = "pnpm"
    }
  }

  $candidateRuntimeRoots = @(
    (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"),
    (Join-Path $env:LOCALAPPDATA "codex-runtimes\codex-primary-runtime\dependencies")
  )
  foreach ($codexRuntimeRoot in $candidateRuntimeRoots) {
    $codexPnpm = Join-Path $codexRuntimeRoot "bin\fallback\pnpm.cmd"
    $codexNodeBin = Join-Path $codexRuntimeRoot "node\bin"
    $codexFallbackBin = Join-Path $codexRuntimeRoot "bin\fallback"
    if ((Test-Path $codexPnpm) -and (Test-Path $codexNodeBin)) {
      return @{
        Command = $codexPnpm
        PathPrefix = "$codexNodeBin;$codexFallbackBin;"
        InstallArgs = @("install")
        DevArgs = @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort")
        Label = "bundled pnpm"
      }
    }
  }

  $npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $npm) {
    $npm = Get-Command "npm" -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if ($npm) {
    return @{
      Command = $npm.Source
      PathPrefix = ""
      InstallArgs = @("install")
      DevArgs = @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort")
      Label = "npm"
    }
  }

  throw "No frontend runner was found. Install Node.js 22.13+ with pnpm, or run this launcher from Codex once so the bundled Node runtime is available."
}

function Test-Url([string]$Url) {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Wait-ForUrl([string]$Url, [int]$Seconds, [string]$Name) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    if (Test-Url $Url) {
      Write-Host "$Name is ready: $Url" -ForegroundColor Cyan
      return $true
    }
    Start-Sleep -Seconds 1
  }
  Write-Host "$Name did not respond within $Seconds seconds. Check its service window logs." -ForegroundColor Yellow
  return $false
}

Set-Location $ProjectRoot

Write-Step "Checking launch environment"
$pythonCommand = $null
if (-not (Test-Path $VenvPython)) {
  $pythonCommand = Get-RequiredCommand @("python", "py") "Python was not found. Install Python 3.10+ and run this launcher again."
}
$frontendRunner = Get-FrontendRunner
Write-Host "Project root: $ProjectRoot"
Write-Host "Backend root: $BackendRoot"
Write-Host "Frontend runner: $($frontendRunner.Label) at $($frontendRunner.Command)"

if ($DryRun) {
  Write-Host "Dry run passed. No environment was created and no services were started." -ForegroundColor Cyan
  exit 0
}

if (-not (Test-Path $VenvPython)) {
  Write-Step "Creating backend Python virtual environment"
  if ((Split-Path -Leaf $pythonCommand) -ieq "py.exe") {
    & $pythonCommand -3 -m venv $VenvRoot
  } else {
    & $pythonCommand -m venv $VenvRoot
  }
}

Write-Step "Checking backend dependencies"
& $VenvPython -c "import fastapi, uvicorn, transformers, torch" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Installing backend dependencies. First run may take a while..."
  & $VenvPython -m pip install -r $RequirementsFile
}

Write-Step "Checking frontend dependencies"
if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
  Write-Host "Installing frontend dependencies..."
  if ($frontendRunner.PathPrefix) {
    $env:Path = $frontendRunner.PathPrefix + $env:Path
  }
  & $frontendRunner.Command @($frontendRunner.InstallArgs)
}

if (Test-Url "$BackendUrl/health") {
  Write-Host "Backend is already running: $BackendUrl" -ForegroundColor Cyan
} else {
  Write-Step "Starting RecipeNLG backend"
  $backendCommand = @"
Set-Location $(Quote-ForPowerShell $BackendRoot)
`$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"
& $(Quote-ForPowerShell $VenvPython) -m uvicorn app:app --host 127.0.0.1 --port 8000
"@
  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $backendCommand
  ) -WindowStyle Normal
  Wait-ForUrl "$BackendUrl/health" 25 "Backend" | Out-Null
}

if (Test-Url $FrontendUrl) {
  Write-Host "Frontend is already running: $FrontendUrl" -ForegroundColor Cyan
  Start-Process $FrontendUrl
} else {
  Write-Step "Starting frontend and opening browser"
  $frontendCommand = @"
Set-Location $(Quote-ForPowerShell $ProjectRoot)
`$env:Path = "$( $frontendRunner.PathPrefix )" + `$env:Path
`$env:VITE_RECIPE_API_URL = "$BackendUrl"
& $(Quote-ForPowerShell $frontendRunner.Command) $($frontendRunner.DevArgs -join " ")
"@
  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $frontendCommand
  ) -WindowStyle Normal
  if (Wait-ForUrl $FrontendUrl 25 "Frontend") {
    Start-Process $FrontendUrl
  }
}

Write-Step "Launch flow complete"
Write-Host "Keep the backend and frontend windows open. Closing a window stops that service." -ForegroundColor Yellow
Write-Host "Frontend URL: $FrontendUrl"
Write-Host "Backend URL: $BackendUrl"
