$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$required = @(
  'manifest.json',
  'assets/audio/rest-downpour-original.mp3',
  'assets/audio/rest-thunder-original.mp3',
  'assets/audio/rest-lofi-original.mp3',
  'assets/audio/rest-wind-v3.mp3', 'index.html', 'src/app/bootstrap.js', 'src/app/store.js',
  'src/services/permissions.js',
  'src/widgets/planning-definitions.js',
  'tests/planning-smoke.mjs',
  'tests/persistence-restart-smoke.mjs',
  'src/styles/design-polish.css',
  'tests/permissions-smoke.mjs',
  'src/app/persistence.js', 'src/app/geometry.js', 'src/app/backup-service.js', 'src/widgets/registry.js',
  'src/widgets/definitions.js', 'src/widgets/rest-definition.js', 'src/ui/workspace.js', 'src/ui/floating-panel.js', 'src/ui/color-editor.js', 'src/ui/select-menu.js', 'src/ui/notifications.js', 'src/ui/properties-panel.js',
  'src/themes/theme-manager.js', 'src/styles/tokens.css', 'src/styles/layout.css',
  'src/styles/widgets.css', 'src/styles/notifications.css', 'tests/core-smoke.mjs', 'tests/module-smoke.mjs',
  'tests/migration-smoke.mjs', 'tests/backup-smoke.mjs', 'tests/browser-smoke.mjs'
)
$failed = @()
foreach ($relative in $required) {
  if (-not (Test-Path (Join-Path $root $relative))) { $failed += "Missing: $relative" }
}
try {
  $manifest = Get-Content -Raw (Join-Path $root 'manifest.json') | ConvertFrom-Json
  if ($manifest.manifest_version -ne 3) { $failed += 'manifest_version must equal 3.' }
  if ($manifest.chrome_url_overrides.newtab -ne 'index.html') { $failed += 'newtab override must point to index.html.' }
} catch { $failed += "Invalid manifest.json: $($_.Exception.Message)" }
$index = Get-Content -Raw (Join-Path $root 'index.html')
foreach ($reference in @('src/app/bootstrap.js', 'src/styles/tokens.css', 'src/styles/layout.css', 'src/styles/widgets.css', 'src/styles/notifications.css')) {
  if (-not $index.Contains($reference)) { $failed += "index.html is missing: $reference" }
}
$definitions = Get-Content -Raw (Join-Path $root 'src/widgets/definitions.js')
if (-not $definitions.Contains('basicDefinitions') -or -not $definitions.Contains('networkDefinitions') -or -not $definitions.Contains('searchDefinition') -or -not $definitions.Contains('restDefinition')) { $failed += 'Widget definition groups are incomplete.' }
if ($failed.Count -gt 0) {
  Write-Host 'VALIDATION FAILED' -ForegroundColor Red
  $failed | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}
Write-Host 'VALIDATION PASSED: V5 structure and entry point are valid.' -ForegroundColor Green
