@echo off
chcp 65001 >nul
title بستان المعرفة — Knowledge Garden (Windows Desktop Launcher)

set "APP_URL=%~1"
if "%APP_URL%"=="" set "APP_URL=https://ais-pre-wzr5ws23hlhayf5rvmmtfs-322796148915.europe-west2.run.app"

REM Launch in standalone native-app window using Microsoft Edge or Google Chrome on Windows
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" msedge --app="%APP_URL%" --start-maximized
    exit /b 0
)

where chrome >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" chrome --app="%APP_URL%" --start-maximized
    exit /b 0
)

start "" "%APP_URL%"
