@echo off
chcp 65001 > nul
title Denize Karşı & Palm Beach - Finans, Kasa ve Personel Sistemi
echo ====================================================
echo  DENİZE KARŞI & PALM BEACH
echo  Finans, Kasa ve Personel Yönetim Sistemi
echo  Sunucu Başlatılıyor...
echo ====================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js sisteminizde kurulu bulunamadı!
    echo Lütfen https://nodejs.org adresinden Node.js kurunuz.
    pause
    exit /b
)

if not exist node_modules (
    echo [BILGI] Sunucu bağımlılıkları yükleniyor, lütfen bekleyiniz...
    call npm.cmd install
)

if not exist client\dist (
    echo [BILGI] Arayüz derleniyor, lütfen bekleyiniz...
    call npm.cmd run build:client
)

echo [BILGI] Finans Paneli başlatılıyor: http://localhost:3000
start http://localhost:3000
node server/index.js
pause
