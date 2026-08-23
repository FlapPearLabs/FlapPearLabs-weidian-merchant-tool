git config --global --unset http.proxy 2>$null
git config --global --unset https.proxy 2>$null
Write-Host "Git HTTP/HTTPS proxy cleared." -ForegroundColor Green
