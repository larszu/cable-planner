$token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZWRld2Vya2VyIjoyODcsImFjY291bnQiOiJ0YWxlbnR3ZXJrZmlsbXByb2R1a3Rpb24iLCJjbGllbnRfdHlwZSI6Im9wZW5hcGkiLCJjbGllbnQubmFtZSI6Im9wZW5hcGkiLCJleHAiOjIwNzI4NjU1MjUsImlzcyI6IntcIm5hbWVcIjpcImJhY2tlbmRcIixcInZlcnNpb25cIjpcIjQuNzc4LjAuMVwifSIsImlhdCI6MTc1NzMzMjcyNX0.IVSEipsB06nYoe-Ex0vL14Oq7QmhGdcCIUb9DTDBk7c'

function Test-Header($label, $value, $url) {
  Write-Host ""
  Write-Host "=== $label ==="
  try {
    $r = Invoke-WebRequest -Uri $url -Headers @{ Authorization = $value } -ErrorAction Stop
    Write-Host "OK $($r.StatusCode)"
    Write-Host $r.Content.Substring(0, [Math]::Min(300, $r.Content.Length))
  } catch {
    Write-Host "ERR $($_.Exception.Message)"
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  }
}

Test-Header "Bearer" "Bearer $token" "https://api.rentman.net/projects?limit=1"
Test-Header "Raw" "$token" "https://api.rentman.net/projects?limit=1"
Test-Header "token=" "token=$token" "https://api.rentman.net/projects?limit=1"
