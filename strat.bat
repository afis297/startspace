@echo off
cd /d "%~dp0"

if not exist "aider-env\Scripts\activate.bat" (
    echo [ОШИБКА] Venv не найден. Создай: py -3.12 -m venv aider-env
    pause & exit /b 1
)

call "aider-env\Scripts\activate.bat"
aider --model ollama/qwen2.5-coder:3b --yes
pause