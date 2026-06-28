# OTP Authentication System - Environment Variables

Add these environment variables to your .env file:

## Email Configuration (Required for OTP emails)

# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@verdexis.com

## For Gmail:
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the generated password as SMTP_PASS

## For Other Providers:
- SendGrid: https://sendgrid.com/
- Mailgun: https://www.mailgun.com/
- Amazon SES: https://aws.amazon.com/ses/

## Testing (Development)
In development, if SMTP is not configured, OTP codes will be printed to console.
