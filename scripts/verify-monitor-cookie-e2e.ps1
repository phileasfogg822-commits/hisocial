$ErrorActionPreference = 'Stop'

try {
  $base = 'http://localhost:4000'
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

  $accounts = Invoke-RestMethod -Method Get -Uri "$base/api/accounts" -WebSession $session
  if (-not $accounts) {
    throw 'No accounts found'
  }

  $account = $accounts | Select-Object -First 1
  $null = Invoke-RestMethod -Method Post -Uri "$base/api/accounts/switch" -WebSession $session -ContentType 'application/json' -Body (@{ accountId = $account.id } | ConvertTo-Json)

  $jobs = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/jobs" -WebSession $session
  if (-not $jobs) {
    throw 'No monitor jobs found'
  }

  $job = $jobs | Select-Object -First 1
  $cookieToSet = $env:LINKEDIN_SESSION_COOKIE

  if ([string]::IsNullOrWhiteSpace($cookieToSet)) {
    $dbCookie = (& docker exec socialhub_db psql -U socialhub -d socialhub -t -A -c "SELECT linkedin_session_cookie FROM monitor_jobs WHERE linkedin_session_cookie IS NOT NULL AND linkedin_session_cookie <> '' LIMIT 1;") | Select-Object -First 1
    if ($dbCookie) {
      $cookieToSet = $dbCookie.Trim()
    }
  }

  $cookieSource = 'none'
  if (-not [string]::IsNullOrWhiteSpace($cookieToSet)) {
    $cookieSource = 'env-or-db'
  } else {
    $cookieToSet = 'li_at=invalid_for_test'
    $cookieSource = 'dummy-test'
  }

  $null = Invoke-RestMethod -Method Post -Uri "$base/api/monitor/session-cookie" -WebSession $session -ContentType 'application/json' -Body (@{ jobId = $job.id; linkedinSessionCookie = $cookieToSet } | ConvertTo-Json)

  $jobsAfterSet = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/jobs" -WebSession $session
  $jobAfterSet = $jobsAfterSet | Where-Object { $_.id -eq $job.id } | Select-Object -First 1

  $live = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/live-feed?jobId=$($job.id)&limit=10" -WebSession $session
  $preview = Invoke-RestMethod -Method Get -Uri "$base/api/monitor/preview?jobId=$($job.id)" -WebSession $session

  $looksLoginLike = $false
  foreach ($item in @($live.items)) {
    $text = ("$($item.preview) $($item.url)").ToLowerInvariant()
    if ($text -match 'linkedin: log in|login|sign in|join linkedin') {
      $looksLoginLike = $true
      break
    }
  }

  [ordered]@{
    status = 'ok'
    account = $account.email
    jobId = $job.id
    jobName = $job.name
    cookieSource = $cookieSource
    jobHasSavedCookieFlagBefore = [bool]$job.has_linkedin_session_cookie
    jobHasSavedCookieFlagAfter = [bool]$jobAfterSet.has_linkedin_session_cookie
    liveExamined = [int]$live.total_examined
    liveAnalyzed = [int]$live.analyzed_count
    liveCollectable = [int]$live.collectable_count
    liveFilteredNoise = [int]$live.filtered_noise_count
    liveItemsReturned = @($live.items).Count
    liveLooksLoginLike = $looksLoginLike
    previewUnavailable = [bool]$preview.unavailable
    previewSourceUrl = $preview.source_url
    previewKeyword = $preview.keyword
  } | ConvertTo-Json -Depth 5
}
catch {
  [ordered]@{
    status = 'error'
    message = $_.Exception.Message
  } | ConvertTo-Json -Depth 3
  exit 1
}
