@echo off
echo Stopping server on port 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000') do taskkill /PID %%a /F
timeout /t 2
echo Starting server...
cd server
npm run dev
