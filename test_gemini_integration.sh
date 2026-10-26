#!/bin/bash

# Gemini AI Social Creative Engine v2.0 - Integration Test Script
# Tests the Gemini enhancement layer for critical agents

set -e

BACKEND_URL="http://localhost:4000"
SESSION_COOKIE="${SESSION_COOKIE:-connect.sid=demo_session}"

echo "🧪 Gemini AI Social Creative Engine v2.0 - Integration Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Rule-Based Engine (Baseline)
echo "Test 1: Rule-Based Engine (No Gemini)"
echo "───────────────────────────────────────"

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai/image" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "tone": "professional",
    "category": "restaurant",
    "niche": "Italian Restaurant",
    "heading": "Fresh Pasta Daily",
    "topic": "Homemade Italian Pasta",
    "post_text": "Our pasta is handmade fresh every morning with authentic Italian recipes passed down through generations",
    "hashtags": ["#pasta", "#italian", "#restaurant"],
    "ratio": "1:1",
    "style": "realistic",
    "useEngine": true,
    "enhanceWithGemini": false
  }')

echo "Response (Rule-Based):"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract validation data from rule-based response
RULE_STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
RULE_VALIDATION=$(echo "$RESPONSE" | jq -r '.engine.validation // .validation' 2>/dev/null || echo "unknown")
echo "✓ Status: $RULE_STATUS"
echo ""

# Test 2: Gemini-Enhanced Engine
echo ""
echo "Test 2: Gemini-Enhanced Engine"
echo "───────────────────────────────"
echo "⏳ Running with Gemini thinking layer (may take 8-15 seconds)..."
echo ""

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai/image" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "tone": "professional",
    "category": "restaurant",
    "niche": "Italian Restaurant",
    "heading": "Fresh Pasta Daily",
    "topic": "Homemade Italian Pasta",
    "post_text": "Our pasta is handmade fresh every morning with authentic Italian recipes passed down through generations",
    "hashtags": ["#pasta", "#italian", "#restaurant"],
    "ratio": "1:1",
    "style": "realistic",
    "useEngine": true,
    "enhanceWithGemini": true
  }')

echo "Response (Gemini-Enhanced):"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract metadata
GEMINI_STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
GEMINI_ENHANCED=$(echo "$RESPONSE" | jq -r '.enhanced.thinking_layer' 2>/dev/null || echo "unknown")
GEMINI_AGENTS=$(echo "$RESPONSE" | jq -r '.enhanced.agents_enhanced | join(", ")' 2>/dev/null || echo "unknown")

echo "✓ Status: $GEMINI_STATUS"
echo "✓ Thinking Layer: $GEMINI_ENHANCED"
echo "✓ Agents Enhanced: $GEMINI_AGENTS"
echo ""

# Test 3: Different Category with Gemini
echo ""
echo "Test 3: Different Category - Website Builder (Gemini)"
echo "─────────────────────────────────────────────────────"
echo "⏳ Testing with SaaS category..."
echo ""

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai/image" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "tone": "professional",
    "category": "website_builder",
    "niche": "Website Builder Platform",
    "heading": "Build Your Website Without Coding",
    "topic": "No-Code Website Builder",
    "post_text": "Create professional websites in minutes without writing any code. Drag and drop builder, templates, and hosting included.",
    "hashtags": ["#webdesign", "#nocode", "#startup"],
    "ratio": "1:1",
    "style": "realistic",
    "useEngine": true,
    "enhanceWithGemini": true
  }')

echo "Response (Website Builder with Gemini):"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

SAAS_STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
SAAS_RECOMMENDATION=$(echo "$RESPONSE" | jq -r '.recommendation // .engine.recommendation' 2>/dev/null || echo "unknown")

echo "✓ Status: $SAAS_STATUS"
echo "✓ Recommendation: $SAAS_RECOMMENDATION"
echo ""

# Test 4: Validation Check (Should Pass or Fail Appropriately)
echo ""
echo "Test 4: Validation with Gemini (Should Validate Correctly)"
echo "──────────────────────────────────────────────────────────"
echo "⏳ Testing validation checks..."
echo ""

RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/ai/image" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "tone": "professional",
    "category": "gym",
    "niche": "Fitness Center",
    "heading": "Transform Your Body",
    "topic": "Modern Gym Fitness",
    "post_text": "State-of-the-art equipment, professional trainers, group classes, and nutrition coaching all in one place.",
    "hashtags": ["#fitness", "#gym", "#health"],
    "ratio": "4:5",
    "style": "realistic",
    "useEngine": true,
    "enhanceWithGemini": true
  }')

echo "Response (Gym with Gemini):"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

GYM_STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null || echo "unknown")
GYM_RECOMMENDATION=$(echo "$RESPONSE" | jq -r '.recommendation // .engine.recommendation' 2>/dev/null || echo "unknown")

echo "✓ Status: $GYM_STATUS"
echo "✓ Recommendation: $GYM_RECOMMENDATION"
echo ""

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Gemini Integration Tests Complete"
echo ""
echo "Summary:"
echo "  • Rule-Based Engine:  $RULE_STATUS"
echo "  • Gemini-Enhanced:    $GEMINI_STATUS (Agents: $GEMINI_AGENTS)"
echo "  • Category Test:      $SAAS_STATUS → $SAAS_RECOMMENDATION"
echo "  • Validation Test:    $GYM_STATUS → $GYM_RECOMMENDATION"
echo ""
echo "Next Steps:"
echo "  1. Check that both rule-based and Gemini responses are successful"
echo "  2. Verify 'enhanced.thinking_layer' shows 'Gemini-powered' for test 2-4"
echo "  3. Compare decision quality between rule-based and Gemini versions"
echo "  4. Deploy with A/B testing framework to measure impact"
echo ""
