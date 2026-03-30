# 📋 Plán na 6. února 2026 - Git Push & Deployment

## 🎯 Hlavní cíle

1. **Dokončit deployment opravy pool share acceptance**
2. **Push změn na GitHub**
3. **Ověřit funkčnost mining shares**

---

## ⏰ Ranní úkoly (před pushem)

### 1. Zkontrolovat Docker build na Helsinki serveru
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "
  ls -la /tmp/build.done && \
  docker images | grep zion-pool
"
```

### 2. Pokud build hotov - nasadit nový pool
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "
  docker stop zion-pool-2.9.5-native && \
  docker rm zion-pool-2.9.5-native && \
  docker run -d --name zion-pool-2.9.5-native \
    --network host \
    -e RUST_LOG=info \
    --restart unless-stopped \
    zion-pool:2.9.5-native-fix
"
```

### 3. Otestovat mining shares
```bash
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main/2.9.5
./target/release/zion-universal-miner \
  --pool stratum+tcp://77.42.31.72:3333 \
  --wallet zion1q2d378w0k7c5j2u6u42334d036s4z228r0e0l0r \
  --threads 2
```

**Očekávaný výsledek:**
- `Share #X result: accepted=true` ✅
- V pool logu: `📊 Share ACCEPTED: wallet=...`

---

## 📤 Git Push

### Změněné soubory k pushnutí
```
2.9.5/zion-native/pool/src/stratum/server_v2.rs  # Fix XMRig response + logging
WORK_REPORT_05_FEB_2026.md                        # Report z 5.2.
PLAN_06_FEB_2026.md                               # Tento plán
```

### Commit message
```bash
git add 2.9.5/zion-native/pool/src/stratum/server_v2.rs
git add WORK_REPORT_05_FEB_2026.md
git add PLAN_06_FEB_2026.md

git commit -m "fix(pool): XMRig share response returns boolean instead of object

- Fixed handle_xmrig_submit to return json!(true) instead of json!({\"status\": \"OK\"})
- Miner expects boolean response, was getting object → always false
- Added share acceptance/rejection logging for debugging
- Tested: NCL tasks accepted, mining shares now should work

Fixes: Mining shares rejected despite valid hash"

git push origin main
```

---

## ✅ Verifikační checklist

- [ ] Docker build dokončen (`/tmp/build.done` exists)
- [ ] Nový pool container běží
- [ ] Mining shares jsou přijímány (`accepted=true`)
- [ ] Pool loguje `📊 Share ACCEPTED`
- [ ] Blockchain výška roste (bloky se těží)
- [ ] Git push úspěšný
- [ ] CI/CD prošlo (pokud existuje)

---

## 🔧 Troubleshooting

### Pokud build selhal
```bash
# Zkontroluj error
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "tail -100 /tmp/build.log | grep -i error"

# Restartuj build
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "
  screen -dmS build bash -c 'cd /root/zion-build && \
    docker build -f zion-native/Dockerfile.pool.prod \
    -t zion-pool:2.9.5-native-fix . > /tmp/build.log 2>&1 && \
    touch /tmp/build.done'
"
```

### Pokud shares stále rejected
```bash
# Zkontroluj pool logy
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 \
  "docker logs --tail 100 zion-pool-2.9.5-native 2>&1 | grep -E 'Share|ACCEPT|REJECT'"

# Ověř že běží správný image
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 \
  "docker inspect zion-pool-2.9.5-native | grep Image"
```

### Pokud pool nefunguje
```bash
# Rollback na předchozí verzi
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "
  docker stop zion-pool-2.9.5-native && \
  docker rm zion-pool-2.9.5-native && \
  docker run -d --name zion-pool-2.9.5-native \
    --network host \
    --restart unless-stopped \
    zion-pool:2.9.5-native
"
```

---

## 📊 Metriky k sledování

| Metrika | Před opravou | Po opravě (očekávané) |
|---------|--------------|----------------------|
| Accepted shares | 0 | >0 |
| Rejected shares | 100% | <5% |
| NCL tasks | OK | OK |
| Blocks found | 73 | 73+ |

---

## 🚀 Další kroky po úspěšném testu

1. **Multichain hashrate routing** - implementace 50/20/20/10 rozdělení
2. **External pool integration** - napojení na ETC, RVN, ERG pooly
3. **GPU miner testing** - otestovat GPU mining s CH3

---

## 📝 Poznámky

- SSH klíč: `~/.ssh/zion_hetzner_key`
- Helsinki server: `77.42.31.72`
- Pool port: `3333`
- RPC port: `8444`
- Wallet pro test: `zion1q2d378w0k7c5j2u6u42334d036s4z228r0e0l0r`

---

**Připraveno:** 5. února 2026  
**Plánováno:** 6. února 2026
