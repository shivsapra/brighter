@echo off
title Pushing Brighter to GitHub...
color 0B
echo ========================================================
echo   BRIGHTER - GITHUB PUSH ^& AUTOMATED APK BUILD
echo ========================================================
echo.
set "PATH=C:\Users\Shivs\AppData\Local\Programs\Git\cmd;%PATH%"
cd /d "c:\Users\Shivs\OneDrive\Desktop\firstapp"

echo 1. Pushing commits to https://github.com/shivsapra/brighter.git ...
echo (If a GitHub sign-in window appears, click 'Sign in with your browser')
echo.
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    color 0A
    echo ========================================================
    echo   SUCCESS! Brighter was pushed to GitHub!
    echo.
    echo   Cloud build is now building your Android APK:
    echo   - Actions Dashboard: https://github.com/shivsapra/brighter/actions
    echo   - Releases (Direct APK): https://github.com/shivsapra/brighter/releases
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo   Push failed or was cancelled. Please check your GitHub login.
    echo ========================================================
)
echo.
pause
