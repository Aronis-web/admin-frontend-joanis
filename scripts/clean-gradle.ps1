Get-Process | Where-Object { $_.ProcessName -like '*java*' -or $_.ProcessName -like '*gradle*' } | ForEach-Object {
    Write-Host "Killing $($_.ProcessName) PID $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3
Remove-Item -Recurse -Force 'C:\gradle_cache5' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force 'C:\erp\android\.gradle' -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path 'C:\gradle_cache5' -Force | Out-Null
Write-Host 'cleaned fully'
