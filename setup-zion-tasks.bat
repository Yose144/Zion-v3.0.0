@echo off
echo === Removing old tasks ===
schtasks /delete /tn "ZION-Start-Visible-Stack" /f 2>nul
schtasks /delete /tn "ZION-AutoBackup-15min" /f 2>nul
echo === Creating ZION-Start-Visible-Stack (on logon) ===
schtasks /create /tn "ZION-Start-Visible-Stack" /tr "C:\Users\yosef\Desktop\Zion\2.9.6-main\start-all-visible.bat" /sc onlogon /rl highest /f
echo === Creating ZION-AutoBackup-15min (every 15 min) ===
schtasks /create /tn "ZION-AutoBackup-15min" /tr "C:\Users\yosef\Desktop\Zion\2.9.6-main\backup-local-core.bat" /sc minute /mo 15 /f
echo === Done ===
schtasks /query /tn "ZION-Start-Visible-Stack" | findstr "TaskName"
schtasks /query /tn "ZION-AutoBackup-15min" | findstr "TaskName"
echo Done
