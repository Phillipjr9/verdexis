$body = @{
    email = "test@example.com"
    password = "TestPass123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://verdexis.vercel.app/api/auth/login" -Method POST -ContentType "application/json" -Body $body
