@echo off
chcp 65001 >nul
title بستان المعرفة — الرفع التلقائي على GitHub
echo ========================================================
echo   بستان المعرفة (Knowledge Garden) — الرفع على GitHub
echo ========================================================
echo.

where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] يرجى تثبيت برنامج Git أولاً من: https://git-scm.com
    pause
    exit /b 1
)

if not exist ".git" (
    git init
    git branch -M main
)

git add .
git commit -m "بستان المعرفة — نسخة الكمبيوتر (.EXE) وصفحة كروم المستقلة والأندرويد" 2>nul

where gh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] تم العثور على أداة GitHub CLI، جارٍ إنشاء المستودع ورفع الملفات...
    gh repo create knowledge-garden --public --source=. --remote=origin --push
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [✓] تم رفع المشروع بالكامل على حسابك في GitHub بنجاح!
        pause
        exit /b 0
    )
)

echo.
set /p REPO_URL="أدخل رابط مستودعك الجديد على GitHub (مثال: https://github.com/USERNAME/knowledge-garden.git): "
if "%REPO_URL%"=="" (
    echo [!] لم يتم إدخال الرابط.
    pause
    exit /b 1
)

git remote remove origin 2>nul
git remote add origin "%REPO_URL%"
git push -u origin main --force

echo.
echo [✓] تم رفع المشروع بالكامل على GitHub! سيتم الآن بناء ملف .EXE ونشر صفحة GitHub Pages تلقائياً في قسم Actions.
pause
