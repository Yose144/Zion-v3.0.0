# 🌐 ZION Domain Configuration

**Primary Domain:** www.zionterranova.com  
**Updated:** 29. října 2025

---

## 🏠 Main Domain Structure

### Primary Domain: www.zionterranova.com

**Production (Mainnet):**
- **Main Website:** https://www.zionterranova.com
- **Mining Pool:** https://www.zionterranova.com/mining
- **Blockchain Explorer:** https://www.zionterranova.com/explorer
- **REST API:** https://www.zionterranova.com/api
- **Documentation:** https://www.zionterranova.com/docs

**Testnet:**
- **Testnet Website:** https://www.zionterranova.com/testnet
- **Testnet Faucet:** https://www.zionterranova.com/testnet/faucet
- **Testnet Pool:** https://www.zionterranova.com/testnet/mining
- **Testnet Explorer:** https://www.zionterranova.com/testnet/explorer

---

## 📧 Email Configuration

### Official Emails
- **General:** info@zionterranova.com
- **Support:** support@zionterranova.com
- **Security:** security@zionterranova.com
- **Development:** dev@zionterranova.com
- **Press:** press@zionterranova.com
- **Partnerships:** partnerships@zionterranova.com

---

## 🔗 Social Media

### Official Channels
- **Twitter/X:** https://twitter.com/zionterranova
- **Telegram:** https://t.me/zionblockchain
- **Discord:** https://discord.gg/wvxJ7DhZ8
- **GitHub:** https://github.com/estrelaisabellazion3/Zion-2.8
- **Medium:** https://medium.com/@zionterranova
- **YouTube:** https://youtube.com/@zionterranova

---

## 🌍 DNS Configuration (For DevOps)

### A Records (Single Domain Setup)
```
www.zionterranova.com      → 91.98.122.165
zionterranova.com          → 91.98.122.165 (redirect to www)
```

### CNAME Records
```
# No subdomains needed - all via paths
```

### MX Records (Email)
```
zionterranova.com  MX 10 mail.zionterranova.com
```

---

## 🔒 SSL/TLS Certificates

### Certificate Authority
- **Provider:** Let's Encrypt / Cloudflare
- **Auto-renewal:** Enabled
- **Wildcard:** *.zionterranova.com

### HTTPS Enforcement
- All HTTP traffic redirects to HTTPS
- HSTS enabled (max-age: 31536000)
- TLS 1.2+ required

---

### Migration Notes

### Old Domain References (To Update)
- ~~zion-blockchain.org~~ → **www.zionterranova.com**
- ~~pool.zion-blockchain.org~~ → **www.zionterranova.com/mining**
- ~~api.zion-blockchain.org~~ → **www.zionterranova.com/api**
- ~~explorer.zion-blockchain.org~~ → **www.zionterranova.com/explorer**
- ~~docs.zion-blockchain.org~~ → **www.zionterranova.com/docs**

### Files Updated (29.10.2025)
- ✅ `Readme.md` - Main website links
- ✅ `docs/TESTNET_RELEASE_PLAN_v2.8.3.md` - All domain references
- ✅ `website/index.html` - Social links
- ✅ `docs/DOMAIN_CONFIG.md` - This file (created)

### Pending Updates
- [ ] `docs/COMMUNITY_LAUNCH_MATERIALS.md` - Pool URLs
- [ ] `docs/MULTI_ALGORITHM_MINING_GUIDE.md` - Pool endpoints
- [ ] `docs/BRAND_GUIDELINES.md` - Official domains
- [ ] `.env.production` - Domain environment variables
- [ ] Marketing materials
- [ ] Social media profiles

---

## 🚀 Domain Launch Checklist

### Pre-Launch
- [ ] Domain registered and verified
- [ ] DNS records configured
- [ ] SSL certificates installed
- [ ] Email accounts created
- [ ] Cloudflare configured (if using)

### Post-Launch
- [ ] Update all documentation
- [ ] Update social media links
- [ ] Announce new domain on Discord/Telegram
- [ ] Update GitHub repo description
- [ ] Update CoinMarketCap/CoinGecko listings
- [ ] Set up redirects from old domains (if any)

---

## 📊 Analytics & Monitoring

### Tools
- **Google Analytics:** GA4 property for www.zionterranova.com
- **Cloudflare Analytics:** Traffic and security monitoring
- **Uptime Monitoring:** UptimeRobot / Pingdom
- **SSL Monitoring:** SSL Labs / Qualys

### Key Metrics
- Page load time: < 2s
- SSL rating: A+
- Uptime: 99.9%
- Security headers: All A grades

---

## 🛡️ Security

### DNSSEC
- Enabled on all domains
- Key rotation: Annual

### SPF Record
```
v=spf1 include:_spf.zionterranova.com ~all
```

### DKIM Record
```
default._domainkey.zionterranova.com TXT "v=DKIM1; k=rsa; p=..."
```

### DMARC Record
```
_dmarc.zionterranova.com TXT "v=DMARC1; p=quarantine; rua=mailto:security@zionterranova.com"
```

---

## 📞 Support

For domain-related issues:
- **Technical:** dev@zionterranova.com
- **Security:** security@zionterranova.com
- **General:** info@zionterranova.com

---

**Last Updated:** 29. října 2025  
**Next Review:** 29. listopadu 2025
