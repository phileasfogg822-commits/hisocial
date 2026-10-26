Write-Host "Checking Gemini Integration Deployment..." -ForegroundColor Green
Write-Host ""

# Check files exist
$files = @(
    "backend/src/services/aiSocialCreativeEngineV2.js",
    "backend/src/services/aiSocialCreativeEngineV2Gemini.js",
    "backend/src/routes/ai.js",
    "GEMINI_ENHANCEMENT_PHASE2.md"
)

Write-Host "Checking required files:" -ForegroundColor Cyan
foreach ($f in $files) {
    $path = Join-Path "." $f
    $exists = Test-Path $path
    $status = if ($exists) { "FOUND" } else { "MISSING" }
    Write-Host "  $f : $status" -ForegroundColor $(if ($exists) { "Green" } else { "Red" })
}

Write-Host ""
Write-Host "Next: Run integration tests with test_gemini_integration.ps1" -ForegroundColor Yellow
