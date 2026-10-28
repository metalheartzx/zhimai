@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动作业：知脉 · 知识点诊断 ...
python tools\serve.py
if errorlevel 1 (
  echo.
  echo 未找到 python，尝试使用 py 启动...
  py tools\serve.py
)
pause
