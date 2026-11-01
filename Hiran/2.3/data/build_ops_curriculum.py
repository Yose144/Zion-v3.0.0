#!/usr/bin/env python3
"""
Ops curriculum builder — těží provozní paměť z docs/3.2/REPORTS/*.md do
messages-format tréninkových párů (čeština, persona Hiranyagarbha).

Proč: reporty obsahují reálné incidenty a pasti (v3-tx CLI bug, fail2ban,
sharp deploy, anchor design, mining duty) — přesně to „komplexní znalosti ZION",
co adaptér potřebuje. Doc-dump přístup z v2.2 buildru selhal (null-run),
proto builder vytváří otázku z kontextu sekce a odpověď z obsahu — s omezenou
délkou a různými vzory otázek, ne jedním templejtem.

Použití:
  python3 build_ops_curriculum.py --reports docs/3.2/REPORTS \
      --out ops-curriculum.jsonl [--max-pairs 400]

Co dělá:
- každá `##`/`###` sekce s ≥3 souvislými řádkami textu → 1–2 páry
- otázka: vzor volený podle klíčových slov v nadpisu (deploy/past/bug/měření/…)
- odpověď: obsah sekce zkrácený na ~1200 znaků (sekvenčně, ne uprostřed věty)
- dedup, prázdné/kódové-only sekce se přeskakují
"""

import argparse
import json
import re
from pathlib import Path

SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha — ZION blockchain expert, AI Native agent a operátorský orchestrátor. "
    "Kanonický kód je ve **V3/** (Rust: zion-core, zion-pool, zion-miner, L2/L3 služby, V3/L3/ai-native). "
    "Znáš Ekam Deeksha PoW, konsensus, pool protokol, příkazy **zion** CLI (doctor, status, logs, deploy) a dokumentaci v **V3/docs**. "
    "Legacy stromy mimo V3/ ber jako referenci. Odpovídáš přesně, technicky, v češtině (identifikátory v angličtině)."
)

Q_PATTERNS = [
    (r"zlom|incident|past|bug|chyba|issue|fix|oprav|root cause", ["Co se pokazilo u {t} a jak se to řešilo?", "Popiš incident {t} — příčina a fix.", "Jaká byla příčina problému {t}?"]),
    (r"deploy|nasazen", ["Jak probíhá deploy {t}?", "Na co si dát pozor při nasazování {t}?", "Popiš postup nasazení {t}."]),
    (r"měřen|fps|benchmark|výkon|performance", ["Jaké jsou změřené hodnoty u {t}?", "Co ukázalo měření {t}?"]),
    (r"anchor|kotv|paper|iss", ["Jak funguje {t}?", "Popiš design {t}."]),
    (r"train|trénink|adaptér|lora|vast", ["Jak proběhl trénink {t} a co se ukázalo?", "Co zjistil trénink {t}?"]),
    (r"audít|audit|securit|bezpeč", ["Co ukázal audit {t}?", "Jaká bezpečnostní zjištění přinesl {t}?"]),
    (r"migr|přesun|upgrade", ["Jak proběhla migrace {t}?", "Na co si dát pozor při {t}?"]),
]
Q_FALLBACK = ["Co je {t} a jak funguje?", "Popiš {t}.", "Co je potřeba vědět o {t}?", "Shrň stav {t}."]

MAX_ANSWER = 1200
MIN_BODY_CHARS = 120


def topic_from_title(title: str, filename: str) -> str:
    t = re.sub(r"[#*`_]", "", title).strip()
    t = re.sub(r"^\d+(\.\d+)*\s*", "", t)  # číslování sekcí
    t = t.lstrip(" .,:;—–-").strip()       # zbytky po emoji/markdown
    if len(t) > 70:  # dlouhé nadpisy → jen první klauzule
        t = re.split(r"[,;—:–]", t)[0].strip() or t[:70]
    return t or Path(filename).stem


def pick_question(topic: str, used: set) -> str:
    tl = topic.lower()
    for pattern, qs in Q_PATTERNS:
        if re.search(pattern, tl):
            for q in qs:
                if q not in used:
                    used.add(q)
                    return q.format(t=topic)
            return qs[0].format(t=topic)
    for q in Q_FALLBACK:
        if q not in used:
            used.add(q)
            return q.format(t=topic)
    return Q_FALLBACK[0].format(t=topic)


def trim_body(body: str) -> str:
    body = re.sub(r"\n{3,}", "\n\n", body.strip())
    if len(body) <= MAX_ANSWER:
        return body
    cut = body[:MAX_ANSWER]
    # ukonči na konci věty/odstavce, ne uprostřed
    for sep in ("\n\n", ". ", "\n- ", "\n"):
        idx = cut.rfind(sep)
        if idx > MAX_ANSWER * 0.6:
            return cut[: idx + len(sep)].strip()
    return cut.strip() + "…"


def sections(path: Path):
    """Vrátí [(title, body)] pro ##/### sekce se souvislým textem."""
    text = path.read_text(encoding="utf-8", errors="replace")
    parts = re.split(r"(?m)^(#{2,3})\s+(.+)$", text)
    # parts = [pre, '##', 'title1', 'body1', '##', 'title2', 'body2', ...]
    for i in range(1, len(parts) - 2, 3):
        title, body = parts[i + 1].strip(), parts[i + 2]
        # odfiltruj čistě kódové/tabelní sekce
        prose = re.sub(r"```.*?```", "", body, flags=re.S)
        prose = re.sub(r"^\|.*$", "", prose, flags=re.M)
        if len(prose.strip()) < MIN_BODY_CHARS:
            continue
        yield title, body


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reports", default="docs/3.2/REPORTS")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-pairs", type=int, default=400)
    args = ap.parse_args()

    used_q: set = set()
    seen_a: set = set()
    written = 0
    files = sorted(Path(args.reports).glob("*.md"))
    with open(args.out, "w", encoding="utf-8") as fout:
        for f in files:
            for title, body in sections(f):
                if written >= args.max_pairs:
                    break
                topic = topic_from_title(title, f.name)
                answer = trim_body(body)
                key = answer[:200]
                if key in seen_a:
                    continue
                seen_a.add(key)
                user = pick_question(topic, used_q)
                rec = {
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user},
                        {"role": "assistant", "content": answer},
                    ],
                    "metadata": {"source": str(f), "section": title, "builder": "ops"},
                }
                fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                written += 1
            if written >= args.max_pairs:
                break
    print(f"OK -> {args.out}: {written} párů z {len(files)} reportů")


if __name__ == "__main__":
    main()
