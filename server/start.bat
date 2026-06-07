@echo off
title 教培助手 · 服务端
echo ========================================
echo   JiaoPei Assistant v3.0 - Server
echo ========================================
echo.

cd /d "%~dp0.."

:: 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

:: 安装依赖（如需要）
echo [1/2] 检查 Python 依赖...
pip install -r server/requirements.txt -q

:: 启动服务端
echo [2/2] 启动服务端...
echo.
python -m server.app
pause
