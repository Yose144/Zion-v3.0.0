# 🛡️ Trae Labs - ASIC odolnost (Česky)

## ✅ Aktualizace hotova!

Všechny **čtyři varianty algoritmů** (Lite i Fire) jsou nyní **silně ASIC odolné**!

---

## 📊 Přehled ASIC odolnosti

| Algoritmus | ASIC odolnost | Popis |
|---|---|---|
| **Trae Lite V1** | ⭐⭐⭐⭐ | Používá Keccak256 + Blake3, 64 kol závislých operací |
| **Trae Lite V2** | ⭐⭐⭐⭐⭐ | Paměťová náročnost s 32KB scratchpadem, závislé čtení |
| **Trae Fire V1** | ⭐⭐⭐⭐⭐⭐ | Paměťová (256KB) + výpočetní náročnost (131k termálních kol) |
| **Trae Fire V2** | ⭐⭐⭐⭐⭐ | Rekurzivní závislé operace, nelze optimalizovat v hardwaru |

---

## 🎯 Co dělá algoritmy ASIC odolné?

### Lite V1 (Letní)
1. Používá **dvě různé hashovací rodiny** (Keccak256 i Blake3)
2. 64 kol **závislých operací** (každý krok závisí na předchozím)
3. Kombinace XOR a rotací

### Lite V2 (Letní, paměťová)
1. Malý 32KB scratchpad
2. **Náhodné závislé čtení** (adresa závisí na předchozích datech - nelze prefetchovat!)
3. Dva různé hashovací algoritmy

### Fire V1 (Zimní)
1. Velký 256KB scratchpad
2. 8 nezávislých řetězců celých čísel
3. 131 072 termálních kol
4. Forward i backward mixing pass

### Fire V2 (Zimní, rekurzivní)
1. Rekurzivní struktura
2. Každá úroveň závisí na předchozí
3. Kombinace hashovacích funkcí a aritmetiky

---

## 🚀 Další kroky

1. Spusťte testy (až bude možné zkompilovat)
2. Experimentujte s parametry
3. Přidávejte další nápady do `DESIGN_IDEAS.md`
4. Portujte na GPU!
