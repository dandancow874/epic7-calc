@echo off
setlocal

set "ROOT=%~dp0"
set "RELEASE_DIR=%ROOT%release"
set "RELEASE_EXE=%RELEASE_DIR%\Epic7 Damage Calc Portable.exe"
set "BUILT_EXE=%ROOT%src-tauri\target\release\app.exe"

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

echo.
echo ========================================
echo  Epic7 Calc - update assets and build exe
echo ========================================
echo.

cd /d "%ROOT%"
if errorlevel 1 goto fail

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  goto fail
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found.
  goto fail
)

where cargo >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Rust cargo was not found.
  echo Install Rust first, then run this file again.
  goto fail
)

if not exist "%ROOT%node_modules" (
  echo [1/5] Installing npm dependencies...
  call npm install
  if errorlevel 1 goto fail
) else (
  echo [1/5] npm dependencies found.
)

echo.
echo [2/5] Updating assets from upstream...
call npm run assets:update
if errorlevel 1 goto fail

echo.
echo [3/5] Building Windows exe...
call npx tauri build --no-bundle
if errorlevel 1 goto fail

if not exist "%BUILT_EXE%" (
  echo [ERROR] Built exe was not found:
  echo %BUILT_EXE%
  goto fail
)

echo.
echo [4/5] Copying portable exe...
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
taskkill /IM "Epic7 Damage Calc Portable.exe" /F >nul 2>nul
copy /Y "%BUILT_EXE%" "%RELEASE_EXE%" >nul
if errorlevel 1 goto fail

echo.
echo [5/5] Starting app...
start "" "%RELEASE_EXE%"

echo.
echo Done.
exit /b 0

:fail
echo.
echo Update/build failed. Check the messages above.
pause
exit /b 1
