# Query Rentman API for all equipment
$token = Get-Content "$PSScriptRoot\rentman-token.txt" -Raw
$token = $token.Trim()

$resp = Invoke-RestMethod -Uri "https://api.rentman.net/equipment?limit=300" -Headers @{Authorization="Bearer $token"} -Method GET
$all = $resp.data
$resp2 = Invoke-RestMethod -Uri "https://api.rentman.net/equipment?limit=300&offset=300" -Headers @{Authorization="Bearer $token"} -Method GET
$all += $resp2.data

Write-Host "Total equipment items: $($all.Count)"
Write-Host ""

# Output all sorted by name to a file
$all | Select-Object id,name | Sort-Object name | ForEach-Object { "$($_.id)`t$($_.name)" } | Out-File "$PSScriptRoot\rentman-all.txt" -Encoding UTF8
Write-Host "Written to rentman-all.txt"
