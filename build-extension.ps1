[CmdletBinding()]
param(
  [ValidateSet('all', 'chrome', 'firefox')]
  [string]$Target = 'all',
  [switch]$KeepExisting
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputRoot = Join-Path $ProjectRoot 'dist'
$CommonItems = @('assets', 'src', 'index.html')
$ManifestByTarget = @{
  chrome = 'manifest.json'
  firefox = 'manifest.firefox.json'
}

function Copy-ProjectItem {
  param(
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string]$Destination
  )

  $source = Join-Path $ProjectRoot $Name
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing required project item: $Name"
  }
  Copy-Item -LiteralPath $source -Destination $Destination -Recurse -Force
}

function New-ExtensionArchive {
  param(
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string]$Directory
  )

  $archiveBase = Join-Path $OutputRoot "Startspace-$Name"
  $zipPath = if ($Name -eq 'firefox') { "$archiveBase.zip" } else { "$archiveBase.zip" }
  $finalPath = if ($Name -eq 'firefox') { "$archiveBase-unsigned.xpi" } else { $zipPath }
  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $finalPath -Force -ErrorAction SilentlyContinue
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -LiteralPath $Directory -File -Recurse | Sort-Object FullName | ForEach-Object {
      $relativeName = $_.FullName.Substring($Directory.Length).TrimStart([char]92) -replace '\\', '/'
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relativeName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally {
    $archive.Dispose()
  }
  if ($Name -eq 'firefox') {
    Move-Item -LiteralPath $zipPath -Destination $finalPath -Force
  }
  return $finalPath
}

function Build-Target {
  param([Parameter(Mandatory)] [string]$Name)

  $targetDirectory = Join-Path $OutputRoot $Name
  if ((Test-Path -LiteralPath $targetDirectory) -and -not $KeepExisting) {
    Remove-Item -LiteralPath $targetDirectory -Recurse -Force
  }
  New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

  foreach ($item in $CommonItems) {
    Copy-ProjectItem -Name $item -Destination $targetDirectory
  }

  $manifestSource = Join-Path $ProjectRoot $ManifestByTarget[$Name]
  if (-not (Test-Path -LiteralPath $manifestSource)) {
    throw "Missing manifest for target ${Name}: $($ManifestByTarget[$Name])"
  }
  Copy-Item -LiteralPath $manifestSource -Destination (Join-Path $targetDirectory 'manifest.json') -Force

  $manifest = Get-Content -LiteralPath (Join-Path $targetDirectory 'manifest.json') -Raw | ConvertFrom-Json
  if ($Name -eq 'chrome' -and $manifest.background.service_worker -ne 'src/app/background.js') {
    throw 'Chrome/Vivaldi build must use src/app/background.js as service worker.'
  }
  if ($Name -eq 'firefox') {
    if ($manifest.background.page -ne 'src/app/background-firefox.html') {
      throw 'Firefox build must use src/app/background-firefox.html as background page.'
    }
    $systemPermissions = @($manifest.permissions | Where-Object { $_ -like 'system.*' })
    if ($systemPermissions.Count -gt 0) {
      throw "Firefox build must not request Chromium system APIs: $($systemPermissions -join ', ')"
    }
  }

  [pscustomobject]@{
    Target = $Name
    Directory = $targetDirectory
    Manifest = (Join-Path $targetDirectory 'manifest.json')
  }
}

if (-not $KeepExisting -and (Test-Path -LiteralPath $OutputRoot) -and $Target -eq 'all') {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$targets = if ($Target -eq 'all') { @('chrome', 'firefox') } else { @($Target) }
$results = foreach ($name in $targets) {
  $result = Build-Target -Name $name
  $archive = New-ExtensionArchive -Name $name -Directory $result.Directory
  [pscustomobject]@{
    Target = $result.Target
    Directory = $result.Directory
    Manifest = $result.Manifest
    Archive = $archive
  }
}
$results | ConvertTo-Json
