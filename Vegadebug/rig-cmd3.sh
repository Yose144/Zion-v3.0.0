strings /tmp/zion-miner-real | grep -c ZION_NO_STICKY > /tmp/rig-out.txt
echo S1 >> /tmp/rig-out.txt
md5sum /tmp/zion-miner-real >> /tmp/rig-out.txt
echo S2 >> /tmp/rig-out.txt
stat -c %s /tmp/zion-miner-real >> /tmp/rig-out.txt
echo S3 >> /tmp/rig-out.txt
PID=$(pgrep -f zion-miner-real | head -1)
cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | grep -iE NO_STICKY >> /tmp/rig-out.txt 2>&1
echo S4 >> /tmp/rig-out.txt
ls -la /proc/$PID/fd/1 >> /tmp/rig-out.txt 2>&1
echo S5 >> /tmp/rig-out.txt
readlink /proc/$PID/fd/1 >> /tmp/rig-out.txt 2>&1
echo S6 >> /tmp/rig-out.txt
cat /tmp/zion-miner-stats.json >> /tmp/rig-out.txt 2>&1
echo S7 >> /tmp/rig-out.txt
exec 3<>/dev/tcp/62.171.141.136/8082
cat /tmp/rig-out.txt >&3
exec 3>&-
