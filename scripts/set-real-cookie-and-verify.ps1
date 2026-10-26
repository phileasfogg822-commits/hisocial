param(
  [Parameter(Mandatory = $true)]
  [string]$Token
)

$ErrorActionPreference = 'Stop'

try {
  $base = 'http://localhost:4000'
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

  $accounts = Invoke-RestMethod -Method Get -Uri "$base/api/accounts" -WebSession $session
  if (-not $accounts) { throw 'No accounts found' }

  $account = $accounts | Select-Object -First 1
  $accountId = $account.id
  if ($accountId -is [array]) { $accountId = $accountId[0] }

  $null = Invoke-RestMethod -Method Post -Uri "$base/api/accounts/switch" -WebSession $session -ContentType 'application/json' -Body (@{ accountId = $accountId } | ConvertTo-Json)

  $jobs = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/jobs" -WebSession $session
  if (-not $jobs) { throw 'No monitor jobs found' }

  $job = $jobs | Select-Object -First 1
  $jobId = $job.id
  if ($jobId -is [array]) { $jobId = $jobId[0] }

  $cookieString = "li_at=$Token"

  $null = Invoke-RestMethod -Method Post -Uri "$base/api/monitor/session-cookie" -WebSession $session -ContentType 'application/json' -Body (@{ jobId = $jobId; linkedinSessionCookie = $cookieString } | ConvertTo-Json)

  $jobsAfter = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/jobs" -WebSession $session
  $jobAfter = $jobsAfter | Where-Object { $_.id -eq $jobId } | Select-Object -First 1

  $live = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/live-feed?jobId=$jobId&limit=10" -WebSession $session
  $preview = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/preview?jobId=$jobId" -WebSession $session

  [ordered]@{
    status = 'ok'
    account = $account.email
    jobId = $jobId
    jobName = $job.name
    cookieSaved = [bool]$jobAfter.has_linkedin_session_cookie
    liveExamined = [int]$live.total_examined
    liveAnalyzed = [int]$live.analyzed_count
    liveCollectable = [int]$live.collectable_count
    liveItemsReturned = @($live.items).Count
    previewUnavailable = [bool]$preview.unavailable
    previewSourceUrl = $preview.source_url
  } | ConvertTo-Json -Depth 4
}
catch {
  [ordered]@{
    status = 'error'
    message = $_.Exception.Message
  } | ConvertTo-Json -Depth 3
  exit 1
}
