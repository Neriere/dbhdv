@echo off
chcp 65001 >nul
cd /d "%~dp0sniffer"
call iniciar_sniffer.bat
