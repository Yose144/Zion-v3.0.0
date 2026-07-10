# ZION CLI Troubleshooting (for beginners)

Here is a quick procedure for when "something doesn't work".

## 0) Universal first step

```bash
zion status
zion doctor
```

When `zion` is not in PATH, extract the archive and use `./zion`:

```bash
./zion status
./zion doctor
```

---

## 1) `zion status` shows errors

Continue in this order:

```bash
zion node status
zion pool stats
zion mine status
```

---

## 2) No blocks on the website / explorer is empty

This is most often a node RPC problem.

Check:

```bash
zion node status
```

If the node is not running, the web has no source from which to read chain data.
Try:

```bash
zion node start
zion node sync
```

---

## 3) Mining is not running or shows 0 hashrate

Check:

```bash
zion mine status
zion mine bench
```

If the GPU does not work, try the CPU backend:

```bash
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS --backend cpu
```

If you want the GPU, verify the backend:

- `opencl` — Linux/Windows GPU (AMD, NVIDIA)
- `cuda` — NVIDIA GPU (Linux/Windows)
- `metal` — macOS Apple Silicon GPU

---

## 4) Wallet doesn't work / can't send

Check:

```bash
zion wallet balance --address YOUR_ADDRESS
```

If the balance is 0, check the address in the Explorer:
https://zionterranova.com/explorer

If you forgot the wallet, import it from the file:

```bash
zion wallet import --file my-wallet.json
```

If you lost both the file and the 24 words, **the wallet cannot be restored**.

---

## 5) Node is not syncing

```bash
zion node peers
zion node sync
```

If it has no peers, check network connection and firewall.
The node needs outgoing TCP port 8444 (pool stratum) and incoming/outgoing P2P.

---

## 6) Not sure what to solve first

Stick to this "anti-chaos" order:

1. `zion status`
2. `zion doctor`
3. `zion node status`
4. `zion pool stats`
5. `zion mine status`

Don't immediately restart everything. First diagnose, then act.

---

## 7) Binary cannot be run (Linux)

```bash
chmod +x zion
./zion
```

If you get "command not found", you are in the wrong folder.
Use the full path:

```bash
/home/user/zion/zion status
```

---

## 8) Binary cannot be run (Windows)

Open PowerShell in the folder with `zion.exe`:

```powershell
.\zion.exe
```

If Windows blocks execution (SmartScreen), click "More info" → "Run anyway".

---

## 9) macOS: "cannot be opened because the developer cannot be verified"

Open via right-click → Open, or:

```bash
xattr -d com.apple.quarantine zion
./zion
```
