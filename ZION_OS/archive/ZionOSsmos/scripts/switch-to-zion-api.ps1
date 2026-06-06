#Requires -Version 5.1
<#
.SYNOPSIS
    Switch SMOS rig to a ZION mining group config via API.
    
    NOTE: You must FIRST create the ZION group config manually in SMOS dashboard
    (Mining -> Rig Groups -> Add Group -> Custom Miner).
    Then run this script to switch your rig to that group and reload.

.PARAMETER ApiKey
    Your SMOS API key

.PARAMETER RigId
    Rig ID to switch (default: auto-detect ZionRig)

.PARAMETER GroupId
    ID of the ZION group config you created manually

.PARAMETER GroupName
    Name of the ZION group config (used for verification)

.EXAMPLE
    .\switch-to-zion-api.ps1 -ApiKey "api-..." -GroupId 9999999
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [int]$RigId = 0,

    [Parameter(Mandatory=$true)]
    [int]$GroupId,

    [string]$GroupName = "ZION-EdgePool"
)

$BaseUrl = 'https://api.simplemining.net'
$Headers = @{
    'X-AUTH-TOKEN' = $ApiKey
    'Content-Type' = 'application/merge-patch+json'
}

Write-Host "═══ SMOS API — Switch Rig to ZION Group ═══" -ForegroundColor Cyan

# 1. Verify group config exists
Write-Host "`n[1/4] Verifying group config $GroupId..." -ForegroundColor Yellow
$groups = Invoke-RestMethod -Uri "$BaseUrl/rig-groups/user-list" -Headers $Headers -TimeoutSec 15
$group = $groups | Where-Object { $_.id -eq $GroupId }
if (-not $group) {
    Write-Host "ERROR: Group config $GroupId not found." -ForegroundColor Red
    Write-Host "Create it first in SMOS dashboard: Mining -> Rig Groups -> Add Group" -ForegroundColor Red
    exit 1
}
Write-Host "      Found: $($group.name) (id=$GroupId)" -ForegroundColor Green

# 2. Find rig if not specified
if ($RigId -eq 0) {
    Write-Host "`n[2/4] Auto-detecting rig..." -ForegroundColor Yellow
    $rigs = Invoke-RestMethod -Uri "$BaseUrl/rigs/user-list" -Headers $Headers -TimeoutSec 15
    $rig = $rigs | Where-Object { $_.name -like '*Zion*' } | Select-Object -First 1
    if (-not $rig) { $rig = $rigs | Select-Object -First 1 }
    if (-not $rig) {
        Write-Host "ERROR: No rigs found." -ForegroundColor Red
        exit 1
    }
    $RigId = $rig.id
    Write-Host "      Found: $($rig.name) (id=$RigId)" -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Using rig id: $RigId" -ForegroundColor Green
}

# 3. Switch group
Write-Host "`n[3/4] Switching rig $RigId to group $GroupId..." -ForegroundColor Yellow
$payload = @{
    rigIds = @($RigId)
    rigGroupId = $GroupId
    execute = 'reload'
} | ConvertTo-Json -Depth 3

try {
    $req = [System.Net.WebRequest]::Create("$BaseUrl/rigs/change-rig-group")
    $req.Method = 'PATCH'
    $req.ContentType = 'application/merge-patch+json'
    $req.Headers.Add('X-AUTH-TOKEN', $ApiKey)
    $req.Timeout = 15000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $response = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host "      Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "      Response: $body" -ForegroundColor DarkGray
} catch [System.Net.WebException] {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "      Error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "      Body: $($reader.ReadToEnd())" -ForegroundColor Red
    exit 1
}

# 4. Verify
Write-Host "`n[4/4] Verifying switch..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$rigDetail = Invoke-RestMethod -Uri "$BaseUrl/rigs/$RigId" -Headers $Headers -TimeoutSec 15
$newGroup = $rigDetail.rigGroup
Write-Host "      Rig now in group: $($newGroup.name) (id=$($newGroup.id))" -ForegroundColor Green

Write-Host "`n═══ Done ═══" -ForegroundColor Cyan
Write-Host "Rig $RigId switched to '$($group.name)' and miner reloaded."
Write-Host "Check SMOS dashboard for mining status."
