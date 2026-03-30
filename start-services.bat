@echo off
REM Quick start script for running all microservices locally (Windows)

echo.
echo Starting Card Scanner Microservices...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo ERROR: Python not found. Please install Python 3.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo ERROR: Node.js not found. Please install Node.js.
    pause
    exit /b 1
)

echo.
echo [✓] Python and Node.js found
echo.

REM Start Python AI Service
echo [*] Starting Python AI Service on port 8000...
cd ai_service

REM Install Python dependencies if needed
pip install -q -r requirements.txt

REM Start in new window
start "AI Service" python main.py

REM Wait for service to start
timeout /t 3 /nobreak

cd ..

REM Check if AI service is running
powershell -Command "Test-NetConnection -ComputerName localhost -Port 8000" >nul 2>&1
if %errorlevel% EQU 0 (
    echo [✓] AI Service running on http://localhost:8000
) else (
    echo [!] Warning: Could not verify AI Service status
)

echo.

REM Start Node.js Matching Engine
echo [*] Starting Node.js Matching Engine on port 3001...
cd matching-engine

if not exist "node_modules" (
    echo [*] Installing Node dependencies...
    call npm install -q
)

REM Start in new window
start "Matching Engine" cmd /k npm start

REM Wait for service to start
timeout /t 3 /nobreak

cd ..

REM Check if matching engine is running
powershell -Command "Test-NetConnection -ComputerName localhost -Port 3001" >nul 2>&1
if %errorlevel% EQU 0 (
    echo [✓] Matching Engine running on http://localhost:3001
) else (
    echo [!] Warning: Could not verify Matching Engine status
)

echo.
echo ===============================================================
echo [✓] Microservices initialization complete!
echo.
echo   🤖 AI Service        http://localhost:8000
echo      Docs             http://localhost:8000/docs
echo.
echo   🧠 Matching Engine   http://localhost:3001
echo      Health           http://localhost:3001/health
echo.
echo   📱 Next.js Pipeline  http://localhost:3000/api/scan-pipeline
echo.
echo ===============================================================
echo.
echo Test the pipeline:
echo   curl -X POST http://localhost:3000/api/scan-pipeline ^
echo     -F "file=@path/to/card.jpg"
echo.
echo Next, run this command in a separate terminal:
echo   npm run dev
echo.
pause
