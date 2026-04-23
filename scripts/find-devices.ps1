$t = Get-Content "$PSScriptRoot\rentman-token.txt" -Raw
$t = $t.Trim()
$h = @{Authorization="Bearer $t"}
$a = (Invoke-RestMethod "https://api.rentman.net/equipment?limit=300" -Headers $h).data
$b = (Invoke-RestMethod "https://api.rentman.net/equipment?limit=300&offset=300" -Headers $h).data
$all = $a + $b
Write-Host "=== TVLogic ==="
$all | Where-Object { $_.name -match "(?i)tvlogic|tv logic|lvm-|lum-" } | Select-Object id,name | Format-Table -AutoSize
Write-Host "=== JVC ==="
$all | Where-Object { $_.name -match "(?i)^jvc" } | Select-Object id,name | Format-Table -AutoSize
Write-Host "=== Juenger / DAP ==="
$all | Where-Object { $_.name -match "(?i)j.nger|juenger|dap[ -]?8" } | Select-Object id,name | Format-Table -AutoSize
Write-Host "=== Alle Audio/Mixer ==="
$all | Where-Object { $_.name -match "(?i)mixer|mischpult|audio proc|loudness|dap|audio.tool|audio.desk" } | Select-Object id,name | Format-Table -AutoSize
