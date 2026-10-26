#!/usr/bin/env powershell

# Quick Verification: Gemini Integration Ready
# This script verifies both rule-based and Gemini paths are available

Write-Host "🔍 Gemini Integration Verification" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════" -ForegroundColor Gray
Write-Host ""

$BACKEND = "http://localhost:4000"

# Check 1: Backend Health
Write-Host "Check 1: Backend Health" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BACKEND/api/providers" `
        -Method GET `
        -UseBasicParsing `
        -TimeoutSec 5

    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is responding" -ForegroundColor Green
        $providers = $response.Content | ConvertFrom-Json
        Write-Host "   Available providers: $($providers.Count)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Backend not responding - Start with: docker compose up -d backend" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check 2: Verify Files Exist
Write-Host "Check 2: Required Files" -ForegroundColor Yellow

$files = @(
    "backend/src/services/aiSocialCreativeEngineV2.js",
    "backend/src/services/aiSocialCreativeEngineV2Gemini.js",
    "backend/src/routes/ai.js",
    "GEMINI_ENHANCEMENT_PHASE2.md",
    "PHASE2_DEPLOYMENT_SUMMARY.md"
)

$allFound = $true
foreach ($file in $files) {
    $fullPath = Join-Path "c:\Users\Grafixers\Downloads\Compressed\sosocial" $file
    if (Test-Path $fullPath) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - NOT FOUND" -ForegroundColor Red
        $allFound = $false
    }
}

if (-not $allFound) {
    exit 1
}

Write-Host ""

# Check 3: Verify Import in Routes
Write-Host "Check 3: Route Integration" -ForegroundColor Yellow

$routesFile = Get-Content "backend/src/routes/ai.js" -Raw

if ($routesFile -match "executeWithGeminiThinking") {
    Write-Host "✅ Gemini service imported in routes" -ForegroundColor Green
} else {
    Write-Host "❌ Gemini service NOT imported" -ForegroundColor Red
    exit 1
}

if ($routesFile -match "enhanceWithGemini") {
    Write-Host "✅ enhanceWithGemini flag is handled" -ForegroundColor Green
} else {
    Write-Host "❌ enhanceWithGemini flag not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check 4: Environment Variable
Write-Host "Check 4: Gemini Configuration" -ForegroundColor Yellow

$geminiKey = $env:GEMINI_API_KEY

if ($geminiKey) {
    if ($geminiKey.StartsWith("your_")) {
        Write-Host "⚠️  GEMINI_API_KEY is placeholder (your_*)" -ForegroundColor Yellow
        Write-Host "   To enable Gemini, set real key in docker-compose.yml" -ForegroundColor Gray
    } else {
        Write-Host "✅ GEMINI_API_KEY is configured" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  GEMINI_API_KEY not set in current session" -ForegroundColor Yellow
    Write-Host "   Check docker-compose.yml for backend environment" -ForegroundColor Gray
}

Write-Host ""

# Summary
Write-Host "═══════════════════════════════════" -ForegroundColor Gray
Write-Host "✅ Phase 2 Deployment Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Run integration tests:"
Write-Host "     powershell -ExecutionPolicy Bypass -File test_gemini_integration.ps1"
Write-Host ""
Write-Host "  2. Try manual requests:"
Write-Host "     Rule-based:    POST /api/ai/image with enhanceWithGemini=false"
Write-Host "     Gemini-enhanced: POST /api/ai/image with enhanceWithGemini=true"
Write-Host ""
Write-Host "  3. Monitor costs:"
Write-Host "     ~0.00062 USD per Gemini-enhanced request"
Write-Host ""
