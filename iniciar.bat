@echo off
set "BASE=c:\Projetos\SafeStock"

echo.
echo =======================================
echo   SafeStock - Iniciando servicos...
echo =======================================
echo.

echo [1/3] Auth-service porta 8001...
start "Auth-service 8001" /d "%BASE%\auth-service" cmd /k ".venv\Scripts\uvicorn app.main:app --port 8001 --reload"

timeout /t 2 /nobreak >nul

echo [2/3] Backend porta 8000...
start "Backend 8000" /d "%BASE%\backend" cmd /k ".venv\Scripts\uvicorn app.main:app --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [3/3] Frontend porta 5173...
start "Frontend 5173" /d "%BASE%\frontend" cmd /k "npm run dev"

echo.
echo Aguardando servicos subirem (12s)...
timeout /t 12 /nobreak >nul

echo Abrindo navegador...
start "" http://localhost:5173

echo.
echo =======================================
echo   Tudo rodando!
echo   Frontend : http://localhost:5173
echo   API docs : http://localhost:8000/docs
echo   Auth docs: http://localhost:8001/docs
echo   Login    : admin / admin123
echo =======================================
echo.
pause
