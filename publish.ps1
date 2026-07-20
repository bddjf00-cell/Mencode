param(
  [string]$Owner,
  [string]$Repo,
  [string]$Version
)

$pkg = "C:\Users\bddjf\Documents\MemeCraftIA\desktop\package.json"
$json = Get-Content $pkg -Raw | ConvertFrom-Json

if (!$Owner) { $Owner = Read-Host "GitHub username" }
if (!$Repo) { $Repo = Read-Host "GitHub repo" }
if (!$Version) { $Version = Read-Host "Version (ej: 1.1.0)" }

$json.publish.owner = $Owner
$json.publish.repo = $Repo
$json.version = $Version
$json | ConvertTo-Json -Depth 10 | Set-Content $pkg

Write-Host "`nBuilding and publishing v$Version to $Owner/$Repo ..." -ForegroundColor Cyan

npm run publish
