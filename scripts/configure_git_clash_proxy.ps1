param([int]$Port = 7897, [string]$HostName = '127.0.0.1')
$proxy = "http://${HostName}:$Port"
git config --global http.proxy $proxy
git config --global https.proxy $proxy
Write-Host "Git HTTP/HTTPS proxy configured: $proxy" -ForegroundColor Green
Write-Host "Verify: git config --global --get http.proxy"
