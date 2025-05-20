@echo off
setlocal enabledelayedexpansion

set "psCommand="
set "psCommand=%psCommand%$source = 'C:\Users\Dell\Desktop\git nowy\transport\src';"
set "psCommand=%psCommand% $destination = 'C:\Users\Dell\Desktop\git nowy\transport\samepliki';"
set "psCommand=%psCommand% if (-not (Test-Path $destination)) { New-Item -ItemType Directory -Path $destination | Out-Null };"
set "psCommand=%psCommand% Get-ChildItem -Path $source -Recurse -File | ForEach-Object {"
set "psCommand=%psCommand% $relativePath = $_.FullName.Substring($source.Length + 1);"
set "psCommand=%psCommand% $safeFileName = $relativePath -replace '[\\:]', '_';"
set "psCommand=%psCommand% $destinationFile = Join-Path $destination $safeFileName;"
set "psCommand=%psCommand% if (Test-Path $destinationFile) {"
set "psCommand=%psCommand% $counter = 1;"
set "psCommand=%psCommand% do {"
set "psCommand=%psCommand% $destinationFile = Join-Path $destination ($safeFileName + '_' + $counter);"
set "psCommand=%psCommand% $counter++ } while (Test-Path $destinationFile) };"
set "psCommand=%psCommand% $destinationDir = Split-Path $destinationFile;"
set "psCommand=%psCommand% if (-not (Test-Path $destinationDir)) { New-Item -ItemType Directory -Path $destinationDir | Out-Null };"
set "psCommand=%psCommand% Copy-Item $_.FullName -Destination $destinationFile };"
set "psCommand=%psCommand% Write-Host 'Kopiowanie plików zakończone.';"
set "psCommand=%psCommand% Read-Host 'Naciśnij Enter, żeby zamknąć okno'"

powershell -NoProfile -ExecutionPolicy Bypass -Command "!psCommand!"
