@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  Выкладываем сайт 100Авто на Vercel...
echo  Если откроется браузер - войдите в свой аккаунт Vercel и подтвердите вход.
echo.
call npx --yes vercel@latest --prod --yes
echo.
echo  Готово. Ссылка на сайт - в строке "Production" или "Aliased" выше.
echo.
pause
