md5sum /tmp/zion-miner-real > /tmp/dbg.txt 2>&1
echo S1 >> /tmp/dbg.txt
stat -c %s /tmp/zion-miner-real >> /tmp/dbg.txt 2>&1
echo S2 >> /tmp/dbg.txt
strings /tmp/zion-miner-real 2>/dev/null | grep -c ZION_NO_STICKY >> /tmp/dbg.txt 2>&1
echo S3 >> /tmp/dbg.txt
PID=$(pgrep -f zion-miner-real | head -1)
cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | grep -iE NO_STICKY >> /tmp/dbg.txt 2>&1
echo S4 >> /tmp/dbg.txt
tail -20 /tmp/zion-miner.log 2>/dev/null >> /tmp/dbg.txt
echo S5 >> /tmp/dbg.txt
ls -la /proc/$PID/fd/1 >> /tmp/dbg.txt 2>&1
python3 -c "
import socket
s=socket.socket()
s.connect(('62.171.141.136',8080))
d=open('/tmp/dbg.txt','rb').read()
h='POST / HTTP/1.1\r\nHost: 62.171.141.136\r\nContent-Length: '+str(len(d))+'\r\n\r\n'
s.sendall(h.encode()+d)
s.recv(100)
s.close()
"
