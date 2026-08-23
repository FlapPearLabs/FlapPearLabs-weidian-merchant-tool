param([int]$Port = 7897)
$proxy = "http://127.0.0.1:$Port"
git config --global http.proxy $proxy
git config --global https.proxy $proxy
$env:HTTP_PROXY = $proxy
$env:HTTPS_PROXY = $proxy
Write-Host "Git / 当前终端代理已设置为 $proxy"
Write-Host "取消：git config --global --unset http.proxy; git config --global --unset https.proxy"
