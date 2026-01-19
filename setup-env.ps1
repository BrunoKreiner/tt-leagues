# Setup script for local environment variables
# This script creates .env files with test Turnstile keys for local development

Write-Host "Setting up local environment variables..." -ForegroundColor Green

# Backend .env
$backendEnv = @"
# Server
PORT=3001
FRONTEND_URL=http://localhost,http://localhost:5173

# Database
DATABASE_PATH=database/league.db

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Cloudflare Turnstile CAPTCHA (Test Keys for Development)
# Replace with real keys from https://dash.cloudflare.com/?to=/:account/turnstile for production
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Admin seeding
ADMIN_USERNAME=admin
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
ADMIN_EMAIL=admin@tabletennis.local
"@

# Frontend .env
$frontendEnv = @"
VITE_API_URL=http://localhost:3001/api

# Cloudflare Turnstile CAPTCHA (Test Key for Development)
# Replace with real site key from https://dash.cloudflare.com/?to=/:account/turnstile for production
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
"@

# Create backend .env
$backendPath = "backend\.env"
if (Test-Path $backendPath) {
    Write-Host "Backend .env already exists. Skipping..." -ForegroundColor Yellow
} else {
    Set-Content -Path $backendPath -Value $backendEnv
    Write-Host "Created backend\.env" -ForegroundColor Green
}

# Create frontend .env
$frontendPath = "frontend\.env"
if (Test-Path $frontendPath) {
    Write-Host "Frontend .env already exists. Skipping..." -ForegroundColor Yellow
} else {
    Set-Content -Path $frontendPath -Value $frontendEnv
    Write-Host "Created frontend\.env" -ForegroundColor Green
}

Write-Host "`nSetup complete! Test Turnstile keys have been added." -ForegroundColor Green
Write-Host "For production, replace with real keys from Cloudflare Dashboard." -ForegroundColor Cyan
Write-Host "See docs/VERCEL_ENVIRONMENT_SETUP.md for Vercel setup instructions." -ForegroundColor Cyan
