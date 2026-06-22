import re
import sys
p = sys.argv[1]
addr = sys.argv[2]
s = open(p).read()
s = re.sub(r'wallet = ".*"', f'wallet = "{addr}"', s)
open(p, 'w').write(s)
print('wallet updated to', addr)
