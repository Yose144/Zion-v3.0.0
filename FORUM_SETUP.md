# ZION Forum — Setup Plan

> This document outlines options and a step-by-step plan for launching an official ZION community forum.
>
> **Goal:** Create a durable, moderated community space that complements Discord/Telegram and can host long-form discussions, mining support, governance, and local-language boards.

---

## 1. Recommended platform

| Platform | Best for | Hosting | Notes |
|----------|----------|---------|-------|
| **Discourse** | Large, serious community; great moderation, trust levels, multilingual | Self-hosted (Docker) or paid hosted | Industry standard for crypto projects (Ethereum, Cardano, etc.) |
| **Flarum** | Lightweight, modern, easy to self-host | Self-hosted PHP + MySQL | Good for smaller/medium communities; less enterprise features |
| **NodeBB** | Real-time forum with chat, modern UI | Self-hosted Node.js or paid | Good UX, plugin ecosystem |
| **phpBB** | Classic, free, self-hosted | Self-hosted PHP + MySQL | Old but stable; lots of themes and mods |

**Recommendation for ZION:** **Discourse** (self-hosted on the Edge server or a small VPS). It scales well, has excellent anti-spam, trust levels, multilingual categories, and can be integrated with the existing website SSO later.

---

## 2. Suggested forum structure

```text
🌍 Welcome & News
  • Announcements
  • Forum rules & FAQ
  • Introduce yourself

⛏ Mining
  • Pool support (pool.zionterranova.com:8444)
  • Solo mining & node setup
  • GPU / CPU tuning
  • Hardware & profitability

💰 Economics & Trading
  • Tokenomics & emission
  • wZION / DeFi / DEX liquidity
  • Exchanges & listings (CoinGecko, CMC)
  • Price discussion

🛠 Development
  • Node / RPC / API
  • Bridge & WARP
  • ZionDex
  • Community CLI
  • Bug reports & security disclosure

🏛 Governance
  • DAO proposals
  • Humanitarian / Issobella fund votes
  • Guardian nominations

🌐 Local Communities
  • Česky
  • English
  • Español
  • Português
  • Français
  • (expand as needed)

🎮 L4–L6 / Ecosystem
  • OASIS game
  • Free World
  • Issobella missions
  • NFTs & collectibles

💬 Off-topic
  • General chat
  • Meditation / consciousness corner (optional, on-brand)
```

---

## 3. Step-by-step setup (Discourse self-hosted)

### 3.1 Prerequisites
- A server (the existing Edge server `62.171.141.136` or a dedicated small VPS).
- A domain/subdomain: `https://forum.zionterranova.com` (recommended).
- DNS A-record pointing to the server IP.
- Docker + Docker Compose installed.
- SMTP credentials for email verification (e.g., Mailgun, Postmark, or self-hosted SMTP).

### 3.2 Install Discourse
```bash
# On the forum server
sudo mkdir -p /var/discourse
sudo git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse
sudo cp samples/standalone.yml containers/app.yml
# Edit app.yml with domain, SMTP, plugins, etc.
sudo ./discourse-setup
```

### 3.3 Configure `app.yml` essentials
- `DISCOURSE_HOSTNAME: forum.zionterranova.com`
- `DISCOURSE_DEVELOPER_EMAILS: support@zion-blockchain.org`
- SMTP settings for transactional mail.
- Let’s Encrypt for HTTPS (enabled by default in the setup).
- Optional plugins:
  - `discourse-solved` (mark answers in support topics)
  - `discourse-translator` (auto-translate posts)
  - `discourse-akismet` (spam filtering)
  - `discourse-prometheus` (monitoring)

### 3.4 Launch
```bash
cd /var/discourse
sudo ./launcher rebuild app
sudo ./launcher start app
```

### 3.5 Admin setup
- Create the first admin account.
- Set site title, logo, favicon, brand colors (ZION gold/green palette).
- Configure categories (see section 2).
- Set trust levels, anti-spam rules, and moderation team.
- Create a pinned "Welcome / FAQ" topic.

---

## 4. Branding & integration

| Item | Value / Action |
|------|----------------|
| Forum URL | `https://forum.zionterranova.com` |
| Site title | `ZION TerraNova Community` |
| Logo | Use `https://zionterranova.com/zion_logo.png` |
| Favicon | Reuse website favicon |
| Colors | Match `zionterranova.com` palette (emerald/gold) |
| Footer links | Website, Explorer, Whitepaper, GitHub, Discord, Telegram |
| Website integration | Add a "Forum" link to the main website navigation and footer |
| Announcement cross-post | Post the Bitcointalk ANN + a short announcement on the forum |

---

## 5. Moderation & trust model

- **Core team:** ZION developers / Guardians as admins.
- **Guardians / DAO:** Promote active, trusted community members to moderators.
- **Trust levels:** Use Discourse default (0–4) to unlock posting links/images gradually.
- **Anti-spam:** Akismet + watched words + first-post approval for new accounts.
- **Local-language boards:** Recruit native-speaking moderators for each language board.

---

## 6. Launch sequence

1. Stand up Discourse at `forum.zionterranova.com`.
2. Configure categories, branding, and admin team.
3. Create a welcome post linking to the whitepaper, explorer, and Bitcointalk ANN.
4. Announce the forum on:
   - Discord (`https://discord.gg/zion-terranova`)
   - Telegram (`https://t.me/zionterranova`)
   - Website banner / footer
5. Add the forum link to:
   - `README.md` (public repo)
   - `StatusV3.md`
   - CoinGecko / CoinMarketCap submission links (if accepted)
6. Recruit volunteer moderators from the community.
7. (Optional) Run a forum launch campaign — e.g., mining setup contest, first governance poll.

---

## 7. Alternatives if self-hosting is not desired

| Provider | URL | Cost |
|----------|-----|------|
| Discourse.org hosting | https://discourse.org/pricing | Paid tiers |
| Civilized Discourse Construction Kit | Same as above | Paid |
| Flarum self-hosted | https://flarum.org | Free (server cost only) |
| NodeBB self-hosted | https://nodebb.org | Free (server cost only) |

**Recommendation:** Start with self-hosted Discourse on the existing Edge server or a $10–20/month VPS; migrate to paid Discourse hosting if the community grows beyond ~10k monthly active users.

---

## 8. Notes & open decisions

- [ ] Choose final URL: `forum.zionterranova.com` vs `community.zionterranova.com`.
- [ ] Decide whether to allow anonymous browsing or require login for reading.
- [ ] Set up email provider for transactional mail (Mailgun/Postmark recommended).
- [ ] Create a moderation policy aligned with the DAO governance model.
- [ ] Link the forum from the CoinGecko/CoinMarketCap listing pages once live.
