$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $root 'src'
$failed = @()
$jsFiles = Get-ChildItem -Path $src -Filter '*.js' -Recurse

$unsafe = Select-String -Path $jsFiles.FullName -Pattern '\.innerHTML\s*=' -ErrorAction SilentlyContinue
if ($unsafe) { $failed += "Unsafe innerHTML assignment: $($unsafe.Path -join ', ')" }
$bootstrap = Get-Content -Raw (Join-Path $src 'app/bootstrap.js')
foreach ($required in @('createStore', 'loadLayoutState', 'createWidgetRegistry', 'mountWorkspace', 'applyTheme')) {
  if (-not $bootstrap.Contains($required)) { $failed += "bootstrap.js is missing required module: $required" }
}
$registry = Get-Content -Raw (Join-Path $src 'widgets/registry.js')
foreach ($contract in @('register(definition)', 'createWidget(type', 'propertiesFor(widget)')) {
  if (-not $registry.Contains($contract)) { $failed += "registry.js is missing contract: $contract" }
}
$store = Get-Content -Raw (Join-Path $src 'app/store.js')
foreach ($method in @('updateSettings', 'updateWidget', 'batch', 'bringToFront')) {
  if (-not $store.Contains($method)) { $failed += "store.js is missing API: $method" }
}
$floatingPanel = Get-Content -Raw (Join-Path $src 'ui/floating-panel.js')
foreach ($contract in @('mountFloatingPanel', 'panel-move', 'panel-resize')) {
  if (-not $floatingPanel.Contains($contract)) { $failed += "floating-panel.js is missing contract: $contract" }
}
$backup = Get-Content -Raw (Join-Path $src 'app/backup-service.js')
foreach ($contract in @('downloadBackup', 'readBackupFile', 'my-free-layout-tab-backup')) {
  if (-not $backup.Contains($contract)) { $failed += "backup-service.js is missing contract: $contract" }
}
$persistence = Get-Content -Raw (Join-Path $src 'app/persistence.js')
foreach ($contract in @('layoutStateV5', 'migrateLegacyState', 'schemaVersion: 5')) {
  if (-not $persistence.Contains($contract)) { $failed += "persistence.js is missing migration contract: $contract" }
}

$manifestPath = Join-Path $root 'manifest.json'
try {
  $manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
} catch {
  $failed += "manifest.json is not valid JSON: $($_.Exception.Message)"
}
if ($manifest) {
  if ($manifest.manifest_version -ne 3) { $failed += 'manifest.json must use Manifest V3' }
  if ($manifest.host_permissions) { $failed += 'host_permissions must be empty; network access belongs in optional_host_permissions' }
  $expectedHosts = @(
    'https://api.open-meteo.com/*',
    'https://geocoding-api.open-meteo.com/*',
    'https://api.exchangerate-api.com/*',
    'https://api.mymemory.translated.net/*',
    'https://www.youtube.com/*',
    'https://www.youtube-nocookie.com/*'
  )
  foreach ($expectedHost in $expectedHosts) {
    if ($manifest.optional_host_permissions -notcontains $expectedHost) { $failed += "optional_host_permissions is missing: $expectedHost" }
  }
  if ($manifest.content_security_policy.extension_pages -ne "script-src 'self'; object-src 'self';") {
    $failed += 'manifest.json must declare the approved extension_pages CSP'
  }
}
if ($failed.Count -gt 0) {
  Write-Host 'AUDIT FAILED' -ForegroundColor Red
  $failed | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}
Write-Host "AUDIT PASSED: checked $($jsFiles.Count) V5 ES modules." -ForegroundColor Green
