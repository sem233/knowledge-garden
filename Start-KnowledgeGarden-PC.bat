@echo off
chcp 65001 >nul
title بستان المعرفة — Knowledge Garden (PC App Mode)
set "STANDALONE_FILE=%~dp0public\KnowledgeGarden-Standalone.html"
if not exist "%STANDALONE_FILE%" set "STANDALONE_FILE=%~dp0KnowledgeGarden-Standalone.html"

where chrome >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" chrome --app="file:///%STANDALONE_FILE:\=/%" --start-maximized
    exit /b 0
)

where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" msedge --app="file:///%STANDALONE_FILE:\=/%" --start-maximized
    exit /b 0
)

start "" "%STANDALONE_FILE%"
