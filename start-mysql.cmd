@echo off
title APX ERP - MySQL (port 3307) - keep this window open
echo Starting APX ERP MySQL on port 3307...
echo Keep this window open while using the ERP. Close it to stop MySQL.
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="%~dp0mysql\my.ini" --console
pause
