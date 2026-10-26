# Gemini AI Social Creative Engine v2.0 - Integration Test Script (PowerShell)
# Tests the Gemini enhancement layer for critical agents

$BACKEND_URL = "http://localhost:4000"
$SESSION_COOKIE = "connect.sid=demo_session"  # Update with real session if needed

Write-Host "🧪 Gemini AI Social Creative Engine v2.0 - Integration Tests" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Test 1: Rule-Based Engine (Baseline)
Write-Host "Test 1: Rule-Based Engine (No Gemini)" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────" -ForegroundColor Gray

$payload = @{
    tone = "professional"
    category = "restaurant"
    niche = "Italian Restaurant"
    heading = "Fresh Pasta Daily"
    topic = "Homemade Italian Pasta"
    post_text = "Our pasta is handmade fresh every morning with authentic Italian recipes passed down through generations"
    hashtags = @("pasta", "italian", "restaurant")
    ratio = "1:1"
    style = "realistic"
    useEngine = $true
    enhanceWithGemini = $false
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/ai/image" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "Cookie" = $SESSION_COOKIE
        } `
        -Body $payload `
        -UseBasicParsing

    $data = $response.Content | ConvertFrom-Json
    Write-Host "✓ Rule-Based Response: $(($data.status // 'no status').ToUpper())" -ForegroundColor Green
    
    if ($data.engine) {
        Write-Host "  - Recommendation: $($data.engine.recommendation)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Rule-Based Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Gemini-Enhanced Engine
Write-Host "Test 2: Gemini-Enhanced Engine" -ForegroundColor Yellow
Write-Host "───────────────────────────────" -ForegroundColor Gray
Write-Host "⏳ Running with Gemini thinking layer (may take 8-15 seconds)..." -ForegroundColor Cyan
Write-Host ""

$payload = @{
    tone = "professional"
    category = "restaurant"
    niche = "Italian Restaurant"
    heading = "Fresh Pasta Daily"
    topic = "Homemade Italian Pasta"
    post_text = "Our pasta is handmade fresh every morning with authentic Italian recipes passed down through generations"
    hashtags = @("pasta", "italian", "restaurant")
    ratio = "1:1"
    style = "realistic"
    useEngine = $true
    enhanceWithGemini = $true
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/ai/image" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "Cookie" = $SESSION_COOKIE
        } `
        -Body $payload `
        -UseBasicParsing `
        -TimeoutSec 30

    $data = $response.Content | ConvertFrom-Json
    Write-Host "✓ Gemini-Enhanced Response: $(($data.status // 'no status').ToUpper())" -ForegroundColor Green
    
    if ($data.enhanced) {
        Write-Host "  - Thinking Layer: $($data.enhanced.thinking_layer)" -ForegroundColor Cyan
        Write-Host "  - Agents Enhanced: $($data.enhanced.agents_enhanced -join ', ')" -ForegroundColor Cyan
    }
    
    if ($data.engine) {
        Write-Host "  - Recommendation: $($data.engine.recommendation)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Gemini-Enhanced Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Different Category with Gemini
Write-Host "Test 3: Different Category - Website Builder (Gemini)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "⏳ Testing with SaaS category..." -ForegroundColor Cyan
Write-Host ""

$payload = @{
    tone = "professional"
    category = "website_builder"
    niche = "Website Builder Platform"
    heading = "Build Your Website Without Coding"
    topic = "No-Code Website Builder"
    post_text = "Create professional websites in minutes without writing any code. Drag and drop builder, templates, and hosting included."
    hashtags = @("webdesign", "nocode", "startup")
    ratio = "1:1"
    style = "realistic"
    useEngine = $true
    enhanceWithGemini = $true
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/ai/image" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "Cookie" = $SESSION_COOKIE
        } `
        -Body $payload `
        -UseBasicParsing `
        -TimeoutSec 30

    $data = $response.Content | ConvertFrom-Json
    Write-Host "✓ Website Builder Response: $(($data.status // 'no status').ToUpper())" -ForegroundColor Green
    
    if ($data.recommendation) {
        Write-Host "  - Recommendation: $($data.recommendation)" -ForegroundColor Cyan
    }
    if ($data.engine.recommendation) {
        Write-Host "  - Recommendation: $($data.engine.recommendation)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Category Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Validation Check
Write-Host "Test 4: Validation with Gemini" -ForegroundColor Yellow
Write-Host "──────────────────────────────" -ForegroundColor Gray
Write-Host "⏳ Testing validation checks..." -ForegroundColor Cyan
Write-Host ""

$payload = @{
    tone = "professional"
    category = "gym"
    niche = "Fitness Center"
    heading = "Transform Your Body"
    topic = "Modern Gym Fitness"
    post_text = "State-of-the-art equipment, professional trainers, group classes, and nutrition coaching all in one place."
    hashtags = @("fitness", "gym", "health")
    ratio = "4:5"
    style = "realistic"
    useEngine = $true
    enhanceWithGemini = $true
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/ai/image" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "Cookie" = $SESSION_COOKIE
        } `
        -Body $payload `
        -UseBasicParsing `
        -TimeoutSec 30

    $data = $response.Content | ConvertFrom-Json
    Write-Host "✓ Validation Test Response: $(($data.status // 'no status').ToUpper())" -ForegroundColor Green
    
    if ($data.recommendation) {
        Write-Host "  - Recommendation: $($data.recommendation)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "✗ Validation Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "✅ Gemini Integration Tests Complete" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Check that both rule-based and Gemini responses are successful"
Write-Host "  2. Verify 'enhanced.thinking_layer' shows 'Gemini-powered' for Gemini tests"
Write-Host "  3. Compare decision quality between rule-based and Gemini versions"
Write-Host "  4. Deploy with A/B testing framework to measure impact"
Write-Host ""
