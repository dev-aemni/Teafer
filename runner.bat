echo off
echo ====================
echo    RUNNING TEAFER
echo ====================

echo [1/3] Starting the server in a new window...
start "Teafer Server" npx ts-node index.ts

echo [2/3] Waiting for server to initialize...
timeout /t 3 /nobreak >nul

echo [3/3] Opening Teafer in your browser...
start http://localhost:3000

echo.
echo Your server is running in the other command prompt window.
echo To stop the server, simply close that window.

pause