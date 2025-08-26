param(
  [string]$ApiBase = "http://localhost:3001/api"
)

function Write-Section($title) { Write-Host "`n=== $title ===" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "[ERR] $msg" -ForegroundColor Red }

function Invoke-Json {
  param(
    [Parameter(Mandatory)] [ValidateSet('GET','POST','PUT','DELETE')] [string]$Method,
    [Parameter(Mandatory)] [string]$Url,
    [object]$Body,
    [hashtable]$Headers
  )
  $params = @{ Method = $Method; Uri = $Url; ErrorAction = 'Stop' }
  if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6); $params.ContentType = 'application/json' }
  if ($Headers) { $params.Headers = $Headers }
  return Invoke-RestMethod @params
}

$ErrorActionPreference = 'Stop'
$RootBase = ($ApiBase -replace '/api/?$','')

try {
  Write-Section "Health check"
  $health = Invoke-Json -Method GET -Url ($RootBase.TrimEnd('/') + '/health')
  Write-Ok "Health: $($health.status)"
} catch {
  Write-Err "Health check failed: $($_.Exception.Message)"
}

# Admin login
$token = $null
try {
  Write-Section "Admin login"
  $login = Invoke-Json -Method POST -Url ($ApiBase + '/auth/login') -Body @{ username = 'admin'; password = 'admin123' }
  $token = $login.token
  if (-not $token) { throw "No token returned" }
  Write-Ok "Logged in as admin"
} catch {
  Write-Err "Login failed: $($_.Exception.Message)"
  throw
}

# Unauthorized create attempt (no token)
try {
  Write-Section "Unauthorized create (expect 401/403)"
  $name = "Unauthorized League $([System.Guid]::NewGuid().ToString('N').Substring(0,6))"
  $null = Invoke-Json -Method POST -Url ($ApiBase + '/leagues') -Body @{ name = $name; is_public = $true }
  Write-Err "Unexpectedly succeeded creating league without auth"
} catch {
  Write-Ok "Blocked as expected"
}

# Authorized create
$headers = @{ Authorization = "Bearer $token" }
$createdLeague = $null
try {
  Write-Section "Create league (authorized)"
  $name = "E2E League $([System.Guid]::NewGuid().ToString('N').Substring(0,6))"
  $payload = @{ name = $name; description = 'Created by quick-api-tests'; is_public = $true; season = '2025' }
  $resp = Invoke-Json -Method POST -Url ($ApiBase + '/leagues') -Headers $headers -Body $payload
  $createdLeague = $resp.league
  if (-not $createdLeague.id) { throw "No league returned" }
  Write-Ok "Created league id=$($createdLeague.id) name='$($createdLeague.name)'"
} catch {
  Write-Err "Create league failed: $($_.Exception.Message)"
  throw
}

# Duplicate name (expect 409)
try {
  Write-Section "Duplicate league name (expect 409)"
  $dup = Invoke-Json -Method POST -Url ($ApiBase + '/leagues') -Headers $headers -Body @{ name = $createdLeague.name; is_public = $true }
  Write-Err "Unexpectedly created duplicate league"
} catch {
  Write-Ok "Duplicate rejected as expected"
}

# Get league by id
try {
  Write-Section "Get created league"
  $got = Invoke-Json -Method GET -Url ($ApiBase + "/leagues/$($createdLeague.id)")
  Write-Ok "Fetched league: $($got.name) | public=$($got.is_public) | season=$($got.season)"
} catch {
  Write-Err "Fetch created league failed: $($_.Exception.Message)"
}

# List leagues
try {
  Write-Section "List leagues"
  $list = Invoke-Json -Method GET -Url ($ApiBase + '/leagues?page=1&limit=5')
  $count = ($list.leagues | Measure-Object).Count
  Write-Ok "Fetched $count leagues (page 1)"
} catch {
  Write-Err "List leagues failed: $($_.Exception.Message)"
}

Write-Host "`nDone." -ForegroundColor Yellow
