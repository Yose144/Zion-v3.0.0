#!/usr/bin/env python3
"""
Konvertor curriculum JSONL: instruction/input/output → messages chat formát.

Proč: finetune_lora.py::format_for_llama3 čte `messages`; instruction schéma se
dřív tiše přeskočilo (run 2 null-run — REPORT_2026-11-01_HIRAN_VAST_TRAINING §8).
Tenhle konvertor je primární fix: curriculum soubory převede do messages,
takže pipeline dostane skutečná data, a přitom nahradí doc-dump "odpovědi"
šablonou sestávající z instrukce + obsahu (assistant reply začíná větou,
ne dumpen).

Použití:
  python3 convert_to_messages.py in.jsonl out.jsonl [--persona STR]

- System prompt = SYSTEM_PROMPT z finetune_lora.py (Hiranyagarbha persona),
  přepíš --persona pro jinou.
- User = instruction (+ input na novém řádku, pokud není prázdný).
- Assistant = output (verbatim; čištění/rozštěpkování řeší generátor, ne konvertor).
- Páry bez outputu se přeskočí (a vypíše se počet).
- Dedup: identické (user,output) páry se zapíšou jen jednou.
"""

import argparse
import json
import sys

SYSTEM_PROMPT = (
    "Jsi Hiranyagarbha — ZION blockchain expert, AI Native agent a operátorský orchestrátor. "
    "Kanonický kód je ve **V3/** (Rust: zion-core, zion-pool, zion-miner, L2/L3 služby, V3/L3/ai-native). "
    "Znáš Ekam Deeksha PoW, konsensus, pool protokol, příkazy **zion** CLI (doctor, status, logs, deploy) a dokumentaci v **V3/docs**. "
    "Legacy stromy mimo V3/ ber jako referenci. Odpovídáš přesně, technicky, v češtině (identifikátory v angličtině)."
)


def convert_entry(entry: dict, system_prompt: str) -> dict | None:
    """Jeden instruction/output záznam → messages záznam. Vrací None pro přeskočení."""
    if "messages" in entry:
        return entry  # už je v messages — propustit (dedup řeší caller)

    output = entry.get("output", "")
    if not output or not output.strip():
        return None

    instruction = entry.get("instruction", "").strip()
    inp = entry.get("input", "")
    user = instruction
    if inp and inp.strip():
        user = (user + "\n\n" + inp.strip()) if user else inp.strip()
    if not user:
        user = "Vysvětli:"  # prázdná instrukce → neutrální prefix

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user},
        {"role": "assistant", "content": output.strip()},
    ]
    meta = entry.get("metadata", {})
    return {"messages": messages, "metadata": {**meta, "converted": "instruction_to_messages"}}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--persona", default=SYSTEM_PROMPT)
    args = ap.parse_args()

    seen = set()
    written = skipped_dup = skipped_empty = already = 0
    with open(args.input, encoding="utf-8") as fin, open(args.output, "w", encoding="utf-8") as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if "messages" in entry:
                already += 1
            conv = convert_entry(entry, args.persona)
            if conv is None:
                skipped_empty += 1
                continue
            msgs = conv["messages"]
            key = next((m["content"] for m in msgs if m["role"] == "user"), "") + "|" + \
                  next((m["content"] for m in msgs if m["role"] == "assistant"), "")
            if key in seen:
                skipped_dup += 1
                continue
            seen.add(key)
            fout.write(json.dumps(conv, ensure_ascii=False) + "\n")
            written += 1

    print(f"OK {args.input} -> {args.output}")
    print(f"  written={written} dup={skipped_dup} empty={skipped_empty} already_messages={already}")


if __name__ == "__main__":
    main()
