# 🎨 Jak přidat ZION Logo do Dashboardu

## 📥 Krok 1: Ulož logo

Tvoje krásné hexagon Matrix logo s blockchain gradientem ulož jako:

```bash
assets/zion_logo.png
```

**Specifikace:**
- ✅ Hexagon tvar se zakulacenými rohy
- ✅ Matrix zelená barva (#00ff41)
- ✅ Blockchain gradient efekt
- ✅ Transparentní pozadí
- ✅ PNG formát
- 📐 Doporučená velikost: 512x512px nebo větší
- 🔧 Automaticky se zmenší na 80x80px v dashboardu

## 🖼️ Krok 2: Logo se automaticky načte

Dashboard má tento kód (řádky 314-326):

```python
# Try to load ZION Matrix logo
try:
    logo_path = Path('assets/zion_logo.png')
    if logo_path.exists():
        logo_img = Image.open(logo_path)
        logo_img = logo_img.resize((80, 80), Image.Resampling.LANCZOS)
        logo_photo = ImageTk.PhotoImage(logo_img)
        logo_label = tk.Label(header_frame, image=logo_photo, bg='#000000')
        logo_label.image = logo_photo
        logo_label.pack(side=tk.LEFT, padx=(0, 20))
except Exception as e:
    print(f"Logo not found: {e}")
```

### Co se stane:
1. ✅ Dashboard hledá `assets/zion_logo.png`
2. ✅ Pokud existuje, načte ho pomocí PIL/Pillow
3. ✅ Zmenší na 80x80px s LANCZOS kvalitou (nejlepší)
4. ✅ Zobrazí v headeru vedle titulku
5. ✅ Pokud nenajde, pokračuje bez loga (žádná chyba)

## 🎯 Krok 3: Restart dashboardu

```bash
# Zastav běžící dashboard
pkill -f "python3 Dashboard_SSH"

# Spusť znovu
python3 Dashboard_SSH_Optimized.py
```

Logo se objeví v levém horním rohu vedle textu:
```
┌─────────────────────────────────────────────────┐
│ [🔷 HEXAGON]  ⚡ Z I O N  M A T R I X  S S H ⚡ │
│     LOGO      > Wake up, Neo...                │
└─────────────────────────────────────────────────┘
```

## 🎨 Tvoje logo je perfektní!

```
     ╱╲
    ╱  ╲         Matrix zelená hexagon
   │ 📊 │        S blockchain gradientem uvnitř
   │▓▓▓▓│        Digitální čísla a kód
    ╲  ╱         Krásný glow efekt
     ╲╱          Transparentní pozadí
```

### Přesně odpovídá Matrix designu:
- ✅ Hexagon tvar (moderní blockchain symbol)
- ✅ Matrix zelená (#00ff41)
- ✅ Blockchain vzestupný graf
- ✅ Digitální kód na pozadí
- ✅ Neon glow efekt

## 📂 Struktura souborů

```
ZION1/
├── assets/
│   ├── README.md              ← Info o assets
│   └── zion_logo.png          ← TVOJE LOGO SEM! 🎨
├── Dashboard_SSH_Optimized.py ← Dashboard s Matrix UI
└── config/
    └── ssh_config.json        ← SSH konfigurace
```

## 🚀 Hotovo!

Po uložení loga do `assets/zion_logo.png` a restartu dashboardu uvidíš:

1. 🔷 **Krásné hexagon logo** v levém horním rohu
2. ⚡ **Matrix title** vedle loga
3. 🎨 **Vše v Matrix green** designu
4. ✨ **Profesionální vzhled**

**Logo je připraveno! Jen ho ulož a restart! 🎉**
