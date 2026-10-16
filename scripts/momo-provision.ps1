# MTN MoMo sandbox provisioner (PowerShell)
param(
  [string]$SubscriptionKey = $env:MOMO_SUBSCRIPTION_KEY,
  [string]$BaseUrl = $env:MOMO_BASE_URL,
  [string]$CallbackHost = $env:MOMO_CALLBACK_HOST
)

if (-not $SubscriptionKey) {
  Write-Error "MOMO_SUBSCRIPTION_KEY is required (or pass -SubscriptionKey)"
  exit 2
}
if (-not $BaseUrl) { $BaseUrl = "https://sandbox.momodeveloper.mtn.com" }

$apiUser = [guid]::NewGuid().ToString()
$headersKey = @{ "Ocp-Apim-Subscription-Key" = $SubscriptionKey }

if (-not $CallbackHost) {
  $cb = $env:MOMO_CALLBACK_BASE_URL
  if ($cb) { $CallbackHost = ([System.Uri]$cb).Host } else { $CallbackHost = "inteliscrap.example.com" }
}

# Create API user
try {
  $body = @{ providerCallbackHost = $CallbackHost } | ConvertTo-Json -Compress
  $r1 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1_0/apiuser" -Headers ($headersKey + @{ "X-Reference-Id" = $apiUser; "Content-Type" = "application/json" }) -Body $body -StatusCodeVariable sc1
  if ($sc1 -ne 201) { throw "Unexpected status $sc1" }
} catch {
  Write-Error "POST /v1_0/apiuser failed: $_"
  exit 1
}

# Create API key
try {
  $r2 = Invoke-RestMethod -Method Post -Uri "$BaseUrl/v1_0/apiuser/$apiUser/apikey" -Headers $headersKey -StatusCodeVariable sc2
  if ($sc2 -ne 200 -and $sc2 -ne 201) { throw "Unexpected status $sc2" }
  $apiKey = $r2.apiKey
} catch {
  Write-Error "POST /v1_0/apiuser/$apiUser/apikey failed: $_"
  exit 1
}

Write-Host "=== MTN MoMo Sandbox Provisioning ==="
Write-Host "MOMO_BASE_URL=$BaseUrl"
Write-Host "MOMO_API_USER=$apiUser"
Write-Host "MOMO_API_KEY=$apiKey"
Write-Host "=== Copy these into .env / Render env vars ==="
Write-Host "Also set: MOMO_ENABLED=true, MOMO_SUBSCRIPTION_KEY=$SubscriptionKey, MOMO_TARGET_ENVIRONMENT=sandbox, MOMO_CURRENCY=EUR"
exit 0
