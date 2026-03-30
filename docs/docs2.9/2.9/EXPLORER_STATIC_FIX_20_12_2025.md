# ZION Explorer - Oprava pro statický hosting

**Datum**: 20. prosince 2025  
**Verze**: v2.9.0  
**Status**: ✅ DEPLOYED na test server (91.98.122.165)

---

## 🎯 Problém

Explorer na statickém hostingu (Nginx servíruje `out/`) nefungoval:
- Dynamické Next.js App Router routy `/explorer/address/[addr]`, `/explorer/tx/[hash]`, `/explorer/block/[id]` vracely 404
- Uživatel nemohl vyhledat miner adresu ani zobrazit detaily transakcí
- Build s `output: "export"` selhal na `useSearchParams()` bez Suspense boundary

---

## 🔧 Řešení

### 1. Backend API - Address Filtr ✅

**Soubor**: `api/__init__.py`

**Změny**:
- Přidán query parametr `address` do `GET /blockchain/transactions`
- Validace formátu adresy (bech32 `zion1...` nebo `ZION...`, max délka 128)
- DB query rozšířena: `WHERE sender = ? OR receiver = ?`
- RPC fallback filtruje transakce podle `sender`/`receiver`

**Příklad použití**:
```bash
# Všechny transakce
GET /api/blockchain/transactions?limit=50&offset=0

# Transakce pro konkrétní adresu
GET /api/blockchain/transactions?limit=50&offset=0&address=zion1l6qc...
```

**Testing**:
```bash
# Ověřeno na produkci
curl -s "https://www.zionterranova.com/api/blockchain/transactions?address=zion1l6qc8vr3xrhxhp4vgqvdkmg2sfr76v9rj6ajsu6ncgz7vtdkrpfs56aq9u&limit=5"
```

---

### 2. Frontend - Přechod na statické query-param stránky ✅

#### Problém s dynamickými routami
Next.js App Router s `output: "export"` **neumí** dynamické routy `[param]` bez `generateStaticParams()`. Na statickém hostingu se tyto routy nestihnou vygenerovat a vrací 404.

#### Řešení: Query parametry + Suspense wrappery

**Vytvořeny nové statické stránky**:

1. **`/explorer/address?addr=<address>`**
   - Server wrapper: [`src/app/explorer/address/page.tsx`](website-v2.9/src/app/explorer/address/page.tsx)
   - Client logika: [`src/app/explorer/address/AddressDetailClient.tsx`](website-v2.9/src/app/explorer/address/AddressDetailClient.tsx)
   - Fetch: `/api/blockchain/transactions?address=...`
   - Zobrazí: received/sent/balance, seznam transakcí, odkazy na tx detail

2. **`/explorer/tx?hash=<tx_id>`**
   - Server wrapper: [`src/app/explorer/tx/page.tsx`](website-v2.9/src/app/explorer/tx/page.tsx)
   - Client logika: [`src/app/explorer/tx/TxDetailClient.tsx`](website-v2.9/src/app/explorer/tx/TxDetailClient.tsx)
   - Fetch: `/api/blockchain/transactions/{tx_id}`
   - Zobrazí: hash, block, timestamp, from/to, amount, fee, confirmations

3. **`/explorer/block?id=<height>`**
   - Server wrapper: [`src/app/explorer/block/page.tsx`](website-v2.9/src/app/explorer/block/page.tsx)
   - Client logika: [`src/app/explorer/block/BlockDetailClient.tsx`](website-v2.9/src/app/explorer/block/BlockDetailClient.tsx)
   - Fetch: `/api/blockchain/blocks/{height}`
   - Zobrazí: height, hash, timestamp, difficulty, nonce, reward, miner, size
   - Navigace: Previous/Next block

4. **`/explorer/transactions?address=<address>`** (optional filtr)
   - Server wrapper: [`src/app/explorer/transactions/page.tsx`](website-v2.9/src/app/explorer/transactions/page.tsx)
   - Client logika: [`src/app/explorer/transactions/TransactionsPageClient.tsx`](website-v2.9/src/app/explorer/transactions/TransactionsPageClient.tsx)
   - Fetch: `/api/blockchain/transactions?limit=50&address=...` (pokud je address parametr)
   - Zobrazí: feed všech transakcí, nebo filtrovaný podle adresy

**Pattern použitý všude**:

```tsx
// page.tsx (server wrapper)
import { Suspense } from "react";
import ComponentClient from "./ComponentClient";

export default function PageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ComponentClient />
    </Suspense>
  );
}

// ComponentClient.tsx
"use client";
import { useSearchParams } from "next/navigation";

export default function ComponentClient() {
  const searchParams = useSearchParams();
  const param = searchParams.get("param");
  // ... fetch data, render UI
}
```

**Proč Suspense?**  
Next.js 16+ vyžaduje, aby `useSearchParams()` byl obalený `<Suspense>` kvůli partial prerendering a statickému exportu. Bez toho build spadne s chybou:
```
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/explorer/..."
```

---

### 3. Odkazy a navigace - Přepojení na query-param routy ✅

**Upravené komponenty**:

1. **`SearchBar.tsx`** ([src/components/explorer/SearchBar.tsx](website-v2.9/src/components/explorer/SearchBar.tsx))
   - Block height → `/explorer/block?id=...`
   - Address → `/explorer/address?addr=...`
   - Rozpoznání tx formátů (`tx_*`, `mining_reward_*`) → `/explorer/tx?hash=...`

2. **`RecentBlocks.tsx`** ([src/components/explorer/RecentBlocks.tsx](website-v2.9/src/components/explorer/RecentBlocks.tsx))
   - Odkazy na bloky: `/explorer/block?id=...`

3. **`RecentTransactions.tsx`** ([src/components/explorer/RecentTransactions.tsx](website-v2.9/src/components/explorer/RecentTransactions.tsx))
   - Odkazy na transakce: `/explorer/tx?hash=...`

4. **Explorer page** ([src/app/explorer/page.tsx](website-v2.9/src/app/explorer/page.tsx))
   - Quick link "Address Intel" změněn na reálnou adresu s query-param linkem

5. **Blocks list** ([src/app/explorer/blocks/page.tsx](website-v2.9/src/app/explorer/blocks/page.tsx))
   - Linky na bloky přepojeny na `/explorer/block?id=...`

---

### 4. Next.js Config - Static Export Mode ✅

**Soubor**: [`website-v2.9/next.config.ts`](website-v2.9/next.config.ts)

**Změna**:
```typescript
// BEFORE
const nextConfig: NextConfig = {
  output: 'standalone', // ❌ vyžaduje Node.js server
  // ...
};

// AFTER
const nextConfig: NextConfig = {
  output: "export",     // ✅ generuje statický out/
  images: {
    unoptimized: true,  // pro statický hosting
  },
  reactCompiler: true,
};
```

**Důsledek**: `npm run build` nyní generuje `out/` místo `.next/standalone/`.

---

### 5. Odstranění legacy dynamických rout ✅

**Smazány staré dynamické routy** (které blokovali static export):
```
❌ src/app/explorer/block/[id]/page.tsx
❌ src/app/explorer/address/[addr]/page.tsx
❌ src/app/explorer/tx/[hash]/page.tsx
❌ src/app/explorer/search/[hash]/page.tsx
```

**Důvod**: Next.js s `output: "export"` nedokáže exportovat dynamické `[param]` routy bez `generateStaticParams()`. Protože máme tisíce transakcí/bloků/adres, není možné je všechny předgenerovat. Řešení = query parametry.

---

### 6. Build a Export ✅

**Příkaz**:
```bash
cd website-v2.9
npm run build
```

**Výstup**:
```
▲ Next.js 16.1.0 (Turbopack)
✓ Compiled successfully
✓ Generating static pages (25/25)

Route (app)
├ ○ /explorer                  # Hlavní explorer
├ ○ /explorer/address           # Address detail (query-param)
├ ○ /explorer/block             # Block detail (query-param)
├ ○ /explorer/blocks            # Block list
├ ○ /explorer/transactions      # Transaction feed
└ ○ /explorer/tx                # Transaction detail (query-param)

○  (Static)  prerendered as static content
```

**Výsledek**: `out/explorer/` obsahuje:
```
out/explorer/
├── address.html            # /explorer/address?addr=...
├── block.html              # /explorer/block?id=...
├── tx.html                 # /explorer/tx?hash=...
├── transactions.html       # /explorer/transactions
└── blocks.html             # /explorer/blocks
```

---

### 7. Deployment na Test Server ✅

**Server**: `91.98.122.165` (TestNet-Zion)  
**Web root**: `/var/www/zionterranova.com/`  
**SSH klíč**: `~/.ssh/zion_server_key`

**Příkaz**:
```bash
cd website-v2.9
rsync -avz --delete -e "ssh -i ~/.ssh/zion_server_key" \
  out/ root@91.98.122.165:/var/www/zionterranova.com/
```

**Statistiky**:
- Přeneseno: 671,076 bytes
- Smazáno: ~200 starých souborů (dynamické routy, staré chunky)
- Rychlost: ~205 KB/s
- Celková velikost: 11.9 MB

**URL**:
- 🌐 **Explorer**: https://www.zionterranova.com/explorer
- 🔍 **Address search**: https://www.zionterranova.com/explorer/address?addr=zion1...
- 📝 **Transaction detail**: https://www.zionterranova.com/explorer/tx?hash=tx_0_...
- 🧊 **Block detail**: https://www.zionterranova.com/explorer/block?id=123

---

## 📊 Ověření funkčnosti

### Backend API ✅
```bash
# Transakce pro konkrétní adresu
curl "https://www.zionterranova.com/api/blockchain/transactions?address=zion1l6qc8vr3xrhxhp4vgqvdkmg2sfr76v9rj6ajsu6ncgz7vtdkrpfs56aq9u&limit=5"

# Výstup: JSON s transakcemi (pouze pro tuto adresu)
{
  "transactions": [
    {
      "tx_id": "tx_0_1766244142_a211e660",
      "sender": "ZION_POOL",
      "receiver": "zion1l6qc8vr3xrhxhp4vgqvdkmg2sfr76v9rj6ajsu6ncgz7vtdkrpfs56aq9u",
      "amount": 1619.63,
      "timestamp": 1766244142,
      "type": "mining_reward",
      "status": "confirmed"
    }
    // ... další transakce
  ]
}
```

### Frontend Explorer ✅
1. **Vyhledávání**: Na `/explorer` v search baru zadej adresu → přesměruje na `/explorer/address?addr=...`
2. **Address detail**: Zobrazí received/sent/balance + seznam transakcí
3. **Transaction link**: Kliknutí na tx → přejde na `/explorer/tx?hash=...`
4. **Block link**: Z tx detailu klik na block → přejde na `/explorer/block?id=...`
5. **Navigation**: Previous/Next block funguje

---

## 🎨 UX Flow

### Příklad: Miner zkontroluje své payouty

1. Otevře https://www.zionterranova.com/explorer
2. Do search baru zadá svou adresu: `zion1l6qc8vr3xrhxhp4vgqvdkmg2sfr76v9rj6ajsu6ncgz7vtdkrpfs56aq9u`
3. Stiskne Enter → přesměrování na `/explorer/address?addr=zion1l6qc...`
4. Uvidí:
   - **Received**: 1619.63 ZION
   - **Sent**: 0.00 ZION
   - **Balance**: 1619.63 ZION
   - Seznam transakcí s časem a částkou
5. Klikne na konkrétní transakci → detail na `/explorer/tx?hash=tx_0_1766244142_a211e660`
6. Uvidí:
   - From: `ZION_POOL`
   - To: `zion1l6qc...` (jeho adresa)
   - Amount: 1619.63 ZION
   - Block: `#123` (klikací link)
   - Status: confirmed
7. Klikne na block link → detail bloku na `/explorer/block?id=123`
8. Uvidí:
   - Block height, hash, timestamp
   - Difficulty, nonce, reward
   - Mined by: jeho adresa
   - Navigace na Previous/Next block

---

## 📁 Soubory změněné/vytvořené

### Backend
- ✏️ [`api/__init__.py`](api/__init__.py) - Přidán `address` filtr do `/blockchain/transactions`

### Frontend
**Nové soubory**:
- ✨ [`website-v2.9/src/app/explorer/address/page.tsx`](website-v2.9/src/app/explorer/address/page.tsx)
- ✨ [`website-v2.9/src/app/explorer/address/AddressDetailClient.tsx`](website-v2.9/src/app/explorer/address/AddressDetailClient.tsx)
- ✨ [`website-v2.9/src/app/explorer/tx/page.tsx`](website-v2.9/src/app/explorer/tx/page.tsx)
- ✨ [`website-v2.9/src/app/explorer/tx/TxDetailClient.tsx`](website-v2.9/src/app/explorer/tx/TxDetailClient.tsx)
- ✨ [`website-v2.9/src/app/explorer/block/page.tsx`](website-v2.9/src/app/explorer/block/page.tsx)
- ✨ [`website-v2.9/src/app/explorer/block/BlockDetailClient.tsx`](website-v2.9/src/app/explorer/block/BlockDetailClient.tsx)
- ✨ [`website-v2.9/src/app/explorer/transactions/page.tsx`](website-v2.9/src/app/explorer/transactions/page.tsx)
- ✨ [`website-v2.9/src/app/explorer/transactions/TransactionsPageClient.tsx`](website-v2.9/src/app/explorer/transactions/TransactionsPageClient.tsx)

**Upravené soubory**:
- ✏️ [`website-v2.9/src/components/explorer/SearchBar.tsx`](website-v2.9/src/components/explorer/SearchBar.tsx)
- ✏️ [`website-v2.9/src/components/explorer/RecentBlocks.tsx`](website-v2.9/src/components/explorer/RecentBlocks.tsx)
- ✏️ [`website-v2.9/src/components/explorer/RecentTransactions.tsx`](website-v2.9/src/components/explorer/RecentTransactions.tsx)
- ✏️ [`website-v2.9/src/app/explorer/page.tsx`](website-v2.9/src/app/explorer/page.tsx)
- ✏️ [`website-v2.9/src/app/explorer/blocks/page.tsx`](website-v2.9/src/app/explorer/blocks/page.tsx)
- ✏️ [`website-v2.9/next.config.ts`](website-v2.9/next.config.ts)

**Smazané soubory**:
- ❌ `src/app/explorer/block/[id]/page.tsx`
- ❌ `src/app/explorer/address/[addr]/page.tsx`
- ❌ `src/app/explorer/tx/[hash]/page.tsx`
- ❌ `src/app/explorer/search/[hash]/page.tsx`

---

## 🔍 Technické detaily

### Proč query parametry místo dynamic routes?

**Problém s `[param]` routami**:
- Next.js App Router s `output: "export"` vyžaduje `generateStaticParams()` pro každou dynamickou routu
- Museli bychom předgenerovat **všechny možné kombinace** (tisíce adres, transakcí, bloků)
- Statický export by zabral GB místa a build by trval minuty/hodiny
- Není škálovatelné

**Řešení s query parametry**:
- Jedna HTML stránka pro každý typ: `address.html`, `tx.html`, `block.html`
- Parametry se čtou z URL query: `?addr=...`, `?hash=...`, `?id=...`
- Client-side fetch dynamicky načte data přes API
- Build rychlý (~20s), export malý (~12 MB)
- Škálovatelné pro miliony záznamů

### Proč Suspense wrapper?

Next.js 16+ používá **Partial Prerendering** (PPR). Když stránka volá `useSearchParams()`, Next potřebuje vědět, která část je dynamická (client-rendered) a která statická. `<Suspense>` boundary označuje hranici mezi statickým a dynamickým obsahem.

Bez Suspense → build error:
```
⨯ useSearchParams() should be wrapped in a suspense boundary
```

S Suspense → build OK:
```tsx
<Suspense fallback={<Loading />}>
  <ClientComponent /> {/* useSearchParams() zde je OK */}
</Suspense>
```

---

## 🚀 Další kroky

### ✅ Hotovo
1. Backend `address` filtr funguje
2. Query-param explorer stránky vytvořeny
3. Suspense wrappery implementovány
4. Static export build prochází
5. Deployment na test server
6. Smoke test OK (transakce viditelné, adresy vyhledatelné)

### ⏳ TODO (budoucí vylepšení)
1. **Address balance caching**: Backend endpoint `/wallet/balance/{address}` pro rychlejší loading
2. **Pagination**: "Load more" tlačítko na tx/block feedech
3. **Advanced search**: Filtr podle data, částky, typu transakce
4. **Transaction graph**: Vizualizace toku ZION mezi adresami
5. **Block explorer analytics**: Stats, charts, top miners
6. **Mempool view**: Zobrazit pending transakce
7. **WebSocket live feed**: Real-time transakce a bloky

---

## 📝 Poznámky pro budoucí maintainera

### Když přidáváš novou explorer stránku:

1. **Vytvoř server wrapper** (`page.tsx`):
```tsx
import { Suspense } from "react";
import YourClient from "./YourClient";

export default function YourPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <YourClient />
    </Suspense>
  );
}
```

2. **Vytvoř client komponentu** (`YourClient.tsx`):
```tsx
"use client";
import { useSearchParams } from "next/navigation";

export default function YourClient() {
  const searchParams = useSearchParams();
  const param = searchParams.get("param");
  // ... fetch & render
}
```

3. **Používej query parametry** místo `[param]` dynamic routes
4. **Testuj build**: `npm run build` musí projít bez chyb
5. **Verifikuj export**: `out/your-route/` musí existovat

### Když deploying na produkci:

1. `npm run build` lokálně
2. Zkontroluj `out/` (všechny potřebné HTML/assets jsou tam)
3. `rsync -avz --delete out/ root@server:/var/www/path/`
4. Smoke test na živé URL
5. Pokud Nginx vrací 404, zkontroluj:
   - Je `try_files $uri $uri/ =404;` v nginx configu?
   - Jsou query parametry správně escapované v URL?
   - Existuje odpovídající `.html` soubor v `out/`?

---

## 🎉 Závěr

Explorer je nyní **plně funkční** na statickém hostingu. Uživatelé mohou:
- ✅ Vyhledat jakoukoli adresu
- ✅ Zobrazit její transakce a balance
- ✅ Kliknout na detail transakce
- ✅ Přejít na detail bloku
- ✅ Navigovat mezi bloky
- ✅ Filtrovat transakce podle adresy

Build je **rychlý** (~20s), export **malý** (~12 MB), deployment **jednoduchý** (jeden rsync příkaz).

**Status**: 🚀 **Production Ready** (na test serveru)

---

**Autor**: GitHub Copilot + Human (Yeshuae)  
**Datum dokončení**: 20. prosince 2025, 23:45 CET  
**Verze dokumentu**: 1.0
