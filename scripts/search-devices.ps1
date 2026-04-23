$all = Get-Content C:\Users\zumpe\cable-planner\scripts\rentman-all.txt

Write-Host "=== TVLogic / TV Logic ==="
$all | Where-Object { $_ -match "tvlogic|tv logic|lvm-|lum-" }

Write-Host ""
Write-Host "=== JVC Monitore ==="
$all | Where-Object { $_ -match "^[\d\s]+JVC" }

Write-Host ""
Write-Host "=== Juenger / DAP ==="
$all | Where-Object { $_ -match "nger|Juenger|DAP.?8" }

Write-Host ""
Write-Host "=== Audio Gear (no cables/adapters) ==="
$all | Where-Object { 
    $_ -match "audio|mixer|mischpult|loudness|proc.*sor|metering|pegel|expander|compressor" -and
    $_ -notmatch "Adapter|kabel|klinke|cinch|firewire|usb|hdmi|displayport|halter"
}

Write-Host ""
Write-Host "=== ALL 600 sorted ==="
$all | Select-Object -First 400
