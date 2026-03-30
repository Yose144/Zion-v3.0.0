# 🎨 ZION Matrix SSH Dashboard - Design Features

## ✨ Úspěšně zachováno z původního Dashboard.py

### 🖼️ **Vizuální Design**
```
✅ ZION Matrix Logo (80x80px)
✅ Zakulacené rohy s neon efekty
✅ Matrix green color scheme (#00ff41, #00dd00, #008800)
✅ Černé pozadí (#000000, #001100, #002200)
✅ Glow efekty pomocí Gaussian blur
✅ Image caching pro výkon
```

### 🎯 **UI Komponenty**

#### Header Section
```
⚡ Z I O N  M A T R I X  S S H ⚡
> Wake up, Neo... The blockchain is on SSH...
[ REMOTE MONITORING • 91.98.122.165 • YESCRYPT MINING ]
```

#### Control Buttons (s hover efekty)
```
[ REFRESH ]  [ SSH STATUS ]  [ START MINING ]  [ STOP MINING ]
```

#### Wallet Login
```
[ AUTHENTICATION REQUIRED ]  [ ENTER MATRIX ]  [ EXIT ]
```

### 📊 **Quick Stats Cards**
Každá karta má:
- ✅ Rounded neon panel (radius=22)
- ✅ Glow efekt (Gaussian blur)
- ✅ Matrix green text
- ✅ Ikona + Title + Value

```
┌─────────────────────────┐  ┌─────────────────────────┐
│   >                     │  │   >                     │
│   SSH STATUS            │  │   BLOCK HEIGHT          │
│   ⚫ CHECKING...        │  │   0                     │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│   >                     │  │   >                     │
│   HASHRATE              │  │   ZION BALANCE          │
│   0.000 H/s            │  │   0.00000000           │
└─────────────────────────┘  └─────────────────────────┘
```

### 🔐 **Wallet Login Dialog**

Krásný Matrix dialog s:
```
🔐 ENTER THE MATRIX
> Follow the white rabbit...

WALLET ADDRESS:
┌──────────────────────────────────────────────┐
│ [input field with #001100 bg, #00ff41 text] │
└──────────────────────────────────────────────┘

PASSWORD (Optional):
┌──────────────────────────────────────────────┐
│ [password field with stars]                  │
└──────────────────────────────────────────────┘

[ LOGIN ]  [ CANCEL ]

💡 Demo: Zion1MainNetWallet123456789
```

### 🎮 **Rounded Button Generator**

```python
def _gen_neon_button(self, text, w=150, h=38, radius=14, hover=False):
    """
    - Vytvoří PNG s rounded rectangle
    - Přidá Gaussian blur glow efekt
    - Normal: #001100 fill, #00ff41 glow
    - Hover: #002200 fill, #00ff88 glow
    - Returns PhotoImage cached v _image_cache
    """
```

### 🖼️ **Rounded Panel Generator**

```python
def _gen_neon_panel(self, w, h, radius=18, fill="#001100", outline="#00ff41", glow="#00ff41"):
    """
    - Smooth rounded corners pomocí PIL ImageDraw
    - Multi-layer glow effect (2x Gaussian blur)
    - Composite layering: glow → fill → outline
    - Cached pro výkon
    """
```

## 🆕 **Nové SSH Funkce**

### 🔗 **SSH Connection Manager**
```python
- Připojení na 91.98.122.165 (production server)
- RSA key nebo password autentizace
- Auto-reconnect při výpadku
- Real-time status monitoring
```

### ⛏️ **Yescrypt Hybrid Miner**
```python
- CPU mining s Yescrypt algoritmem
- 80W power consumption
- +15% eco bonus
- C extension support pro 10x rychlost
- Multi-threading (configurable)
```

### 📊 **Remote Blockchain Stats**
```python
- Block height z SSH serveru
- Difficulty monitoring
- Connection count
- Pool hashrate
- Real-time updates každých 5 sekund
```

## 🎨 **Color Palette**

```python
colors = {
    'bg_primary': '#000000',    # Pure black
    'bg_secondary': '#001100',   # Dark green tint
    'bg_tertiary': '#002200',    # Darker green
    'accent': '#00ff41',         # Matrix bright green
    'accent2': '#00dd00',        # Medium green
    'glow': '#00ff88',          # Glow effect green
    'text': '#00ff41',          # Primary text
    'text_dim': '#00aa00',      # Dimmed text
    'warning': '#ffaa00',       # Orange warning
    'error': '#ff3366'          # Red error
}
```

## 📐 **Design Specifications**

### Window
```
- Size: 1600x1000
- Resizable: True
- Background: #000000
- Padding: 20px
```

### Panels
```
- Border radius: 18-22px
- Glow size: 6px
- Outline width: 2px
- Gaussian blur iterations: 2x
```

### Buttons
```
- Width: 150px (auto-adjusts to text)
- Height: 38px
- Border radius: 14px
- Padding: 16px (8px each side for glow)
- Font: Courier New, 9pt, bold
```

### Stats Cards
```
- Width: 280px
- Height: 120px
- Border radius: 22px
- Inner padding: 12px
- Grid spacing: 12px
```

## 🚀 **Výhody nového designu**

✅ **Zachovaný Matrix styl** - vše jako v původním Dashboard.py
✅ **Krásné zakulacené rohy** - pomocí PIL ImageDraw
✅ **Neon glow efekty** - Gaussian blur layering
✅ **Wallet login systém** - s autentizací
✅ **SSH remote monitoring** - připojení na 91.98.122.165
✅ **Image caching** - rychlý výkon bez flicker
✅ **Hover animace** - interaktivní tlačítka
✅ **Logo support** - assets/zion_logo.png

## 🎯 **Použití**

```bash
# Spusť dashboard
python3 Dashboard_SSH_Optimized.py

# Features:
# - Automatické připojení na SSH server
# - Wallet login pro balance tracking
# - Lokální Yescrypt mining
# - Real-time blockchain stats
# - Krásný Matrix design!
```

---

## 📸 **Screenshots (koncept)**

```
╔════════════════════════════════════════════════════════════╗
║  ⚡ Z I O N  M A T R I X  S S H ⚡                        ║
║  > Wake up, Neo... The blockchain is on SSH...            ║
║  [ REMOTE • 91.98.122.165 • YESCRYPT ]                    ║
╠════════════════════════════════════════════════════════════╣
║ [REFRESH] [SSH STATUS] [START] [STOP]  [ENTER MATRIX]    ║
╠════════════════════════════════════════════════════════════╣
║  ╭───────╮  ╭───────╮  ╭───────╮  ╭───────╮              ║
║  │  SSH  │  │ BLOCK │  │ HASH  │  │ ZION  │              ║
║  │STATUS │  │HEIGHT │  │ RATE  │  │BALANCE│              ║
║  ╰───────╯  ╰───────╯  ╰───────╯  ╰───────╯              ║
╠════════════════════════════════════════════════════════════╣
║  📊 Overview │ ⛏️ Mining │ 🔗 Blockchain │ ⚙️ Settings  ║
║ ┌──────────────────────────────────────────────────────┐ ║
║ │                                                      │ ║
║ │  [Tab Content Here]                                 │ ║
║ │                                                      │ ║
║ └──────────────────────────────────────────────────────┘ ║
╠════════════════════════════════════════════════════════════╣
║ 🚀 Status: Connected to 91.98.122.165 | Mining: Active  ║
╚════════════════════════════════════════════════════════════╝
```

**Design je krásný, funkční a připojený na SSH! 🎨🚀**
