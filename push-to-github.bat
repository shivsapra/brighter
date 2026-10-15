@echo off
title Pushing Brighter to GitHub...
color 0B
echo ========================================================
echo   BRIGHTER - GITHUB PUSH ^& AUTOMATED APK BUILD
echo ========================================================
echo.
set "PATH=C:\Users\Shivs\AppData\Local\Programs\Git\cmd;%PATH%"
cd /d "c:\Users\Shivs\OneDrive\Desktop\firstapp"
echo Pushing main branch to https://github.com/shivsapra/brighter.git ...
echo.
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    color 0A
    echo ========================================================
    echo   SUCCESS! Brighter was successfully pushed to GitHub!
    echo   GitHub Actions is now compiling your signed APK at:
    echo   https://github.com/shivsapra/brighter/actions
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo   Push paused or encountered an error.
    echo ========================================================
)
echo.
pause
