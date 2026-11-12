@echo off
cd /d "%~dp0"
(
 git --version
 git init -b main
 git add -A
 git -c user.name="Lox123101" -c user.email="Lox123101@users.noreply.github.com" commit -m "Demo site for 100Avto with scroll-driven 3D teardown"
 git remote remove origin
 git remote add origin https://github.com/Lox123101/100avto-3d.git
 git push -u origin main
) > push-log.txt 2>&1
echo finished>> push-log.txt
