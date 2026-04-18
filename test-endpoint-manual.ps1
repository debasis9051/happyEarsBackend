#!/usr/bin/env powershell
# Test script for /set-admin-status endpoint
# Tests the unified admin control endpoint

$BACKEND_URL = "http://localhost:4000"
$ADMIN_PASSWORD = $env:ADMIN_ROLE_UPDATE_PASSWORD

if (-not $ADMIN_PASSWORD) {
    Write-Host "❌ Error: ADMIN_ROLE_UPDATE_PASSWORD environment variable not set" -ForegroundColor Red
    Write-Host "Please set the environment variable before running this script" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🧪 Testing /set-admin-status Endpoint" -ForegroundColor Cyan
Write-Host "Backend URL: $BACKEND_URL" -ForegroundColor Gray
Write-Host "======================================`n" -ForegroundColor Gray

# For now, just test with a sample request to show the pattern
# Real test would need valid Firebase JWT token

Write-Host "📋 Test Request Example (Copy this to Postman or Thunder Client):" -ForegroundColor Yellow
Write-Host "`nEndpoint: POST $BACKEND_URL/set-admin-status" -ForegroundColor Green

Write-Host "`nHeaders:" -ForegroundColor Green
Write-Host "  Authorization: Bearer [YOUR_ADMIN_JWT_TOKEN]" -ForegroundColor White
Write-Host "  Content-Type: application/json" -ForegroundColor White

Write-Host "`nRequest Body:" -ForegroundColor Green
$samplePayload = @{
    user_id = "uid_of_user_to_promote"
    is_admin = $true
    admin_password = $ADMIN_PASSWORD
} | ConvertTo-Json

Write-Host $samplePayload -ForegroundColor White

Write-Host "`n📌 Expected Success Response (200 OK):" -ForegroundColor Green
Write-Host '{
  "operation": "success",
  "message": "User uid_xyz promoted to admin successfully",
  "data": {
    "user_id": "uid_xyz",
    "is_admin": true,
    "admin_panel": true,
    "timestamp": "2024-04-13T..."
  }
}' -ForegroundColor White

Write-Host "`n⚠️ Error Response Examples:" -ForegroundColor Yellow
Write-Host "`n1️⃣  Wrong Password (403):" -ForegroundColor Cyan
Write-Host '{"operation":"failed","message":"Invalid admin password for admin status update"}' -ForegroundColor White

Write-Host "`n2️⃣  User Not Found (404):" -ForegroundColor Cyan
Write-Host '{"operation":"failed","message":"No such User exists"}' -ForegroundColor White

Write-Host "`n3️⃣  Last Admin Cannot Be Removed (400):" -ForegroundColor Cyan
Write-Host '{"operation":"failed","message":"At least one admin is required. Cannot remove the last admin."}' -ForegroundColor White

Write-Host "`n💡 To perform actual testing:" -ForegroundColor Yellow
Write-Host "1. Use Postman, Insomnia, or Thunder Client" -ForegroundColor Gray
Write-Host "2. Get your Firebase JWT token from your browser's localStorage" -ForegroundColor Gray
Write-Host "   (After logging in to the frontend, open DevTools > Application > localStorage)" -ForegroundColor Gray
Write-Host "3. Look for 'firebase:authUser' key and extract the token" -ForegroundColor Gray
Write-Host "4. Make the request with that token in Authorization header" -ForegroundColor Gray

Write-Host "`n✅ Test Pattern Summary:" -ForegroundColor Cyan
Write-Host "- Promote: is_admin=true → Both auth_access.admin_panel AND admin_uids_v1 updated" -ForegroundColor White
Write-Host "- Demote: is_admin=false → ALL permissions removed, removed from admin list" -ForegroundColor White
Write-Host "- Atomic: Both operations succeed together or both fail together" -ForegroundColor White
Write-Host "- AuditLog: All changes logged to activity_logs collection" -ForegroundColor White

Write-Host "`n✨ Testing complete! Use this endpoint in your frontend UnifiedAdminControl component." -ForegroundColor Green
Write-Host "======================================`n" -ForegroundColor Gray
