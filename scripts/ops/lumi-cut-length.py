#!/usr/bin/env python3
"""
Délka řezných a gravírovacích drah z výrobního SVG (podklad pro kalkulaci).

Proč: cena lampionu se dá obhájit jen tehdy, když víme, kolik práce v něm je.
„Odhad od oka“ (kolik to asi trvá) se nedá obhájit nikdy. Tenhle skript změří
**skutečnou délku drah** v exportu pro laser (`Lumi_2_A3_3mm_1ku1.svg`, mm)
a rozdělí je podle skupin `CUT` a `ENGRAVE`.

Z délky se pak počítá čas: `délka / rychlost` (mm/s) pro daný výkon laseru.
Rychlosti jsou **vstupní předpoklad** (viz `--cut-speed`, `--engrave-speed`),
ne měření — skutečné hodnoty dá až fyzický výpal. Skript je proto staví
vedle sebe a vypisuje i rozptyl.

Pozn.: export SVG má **všechno v jedné skupině `CUT`**; rozdělení na řez a gravír
nese až DXF (vrstvy `CUT` 20,87 m a `ENGRAVE` 0,31 m — 614 + 22 křivek). Gravír je
tedy nepatrný (drobné značky), hlavní čas dělá řez.

Použití:
    python3 scripts/ops/lumi-cut-length.py
    python3 scripts/ops/lumi-cut-length.py --cut-speed 20 --engrave-speed 250
"""

from __future__ import annotations

import argparse
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_SVG = (
    ROOT
    / "heros/shop/Lumi/Lumi_2_A3_balicek_pro_vypalovani/01_Vypalovani/Lumi_2_A3_3mm_1ku1.svg"
)

# Jak přesně vzorkovat křivky — 1 mm je pro délku dost a je to rychlé.
SAMPLE_MM = 1.0


def sample_cubic(p0, p1, p2, p3, steps):
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        points.append((x, y))
    return points


def sample_quadratic(p0, p1, p2, steps):
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        u = 1 - t
        x = u**2 * p0[0] + 2 * u * t * p1[0] + t**2 * p2[0]
        y = u**2 * p0[1] + 2 * u * t * p1[1] + t**2 * p2[1]
        points.append((x, y))
    return points


def sample_arc(p0, rx, ry, rotation, large_arc, sweep, p1):
    """Oblouky v tomhle exportu nejsou časté — aproximujeme je tětivou po 8 kusech."""
    steps = 8
    return [
        (p0[0] + (p1[0] - p0[0]) * index / steps, p0[1] + (p1[1] - p0[1]) * index / steps)
        for index in range(1, steps + 1)
    ]


NUMBER = re.compile(r"[-\d.]+")
COMMAND = re.compile(r"([MmLlHhVvCcQqAaZz])")


def path_length(d: str) -> float:
    tokens = [token for token in re.split(COMMAND, d) if token.strip()]
    total = 0.0
    current = (0.0, 0.0)
    start = (0.0, 0.0)
    index = 0
    command = "M"
    # `M` jen přesune pero — do délky se počítá až od druhého páru v témže
    # příkazu (implicitní `L`). Bez toho by každá podcesta připočetla „skok“
    # z konce předchozí podcesty na svůj začátek a model by „jezdil“ po celé
    # desce (v praxi to dělalo 36,5 m místo skutečných 21,2 m).
    first_move = True

    while index < len(tokens):
        token = tokens[index]
        if COMMAND.fullmatch(token):
            command = token
            index += 1
            if command in "Zz":
                total += math.dist(current, start)
                current = start
            if command in "Mm":
                first_move = True
            continue

        values = [float(value) for value in NUMBER.findall(token)]
        relative = command.islower()
        kind = command.upper()
        step = 0

        while step < len(values):
            if kind == "M" or kind == "L":
                nx, ny = values[step], values[step + 1]
                point = (current[0] + nx, current[1] + ny) if relative else (nx, ny)
                if kind == "M" and first_move:
                    first_move = False
                    current = point
                    start = point
                    step += 2
                    continue
                total += math.dist(current, point)
                current = point
                if kind == "M":
                    kind = "L"
                    start = point
                step += 2
            elif kind == "H":
                nx = values[step]
                point = (current[0] + nx, current[1]) if relative else (nx, current[1])
                total += math.dist(current, point)
                current = point
                step += 1
            elif kind == "V":
                ny = values[step]
                point = (current[0], current[1] + ny) if relative else (current[0], ny)
                total += math.dist(current, point)
                current = point
                step += 1
            elif kind == "C":
                x1, y1, x2, y2, x, y = values[step : step + 6]
                control1 = (current[0] + x1, current[1] + y1) if relative else (x1, y1)
                control2 = (current[0] + x2, current[1] + y2) if relative else (x2, y2)
                end = (current[0] + x, current[1] + y) if relative else (x, y)
                steps = max(2, int(math.dist(current, end) / SAMPLE_MM))
                previous = current
                for point in sample_cubic(previous, control1, control2, end, steps):
                    total += math.dist(previous, point)
                    previous = point
                current = end
                step += 6
            elif kind == "Q":
                x1, y1, x, y = values[step : step + 4]
                control = (current[0] + x1, current[1] + y1) if relative else (x1, y1)
                end = (current[0] + x, current[1] + y) if relative else (x, y)
                steps = max(2, int(math.dist(current, end) / SAMPLE_MM))
                previous = current
                for point in sample_quadratic(previous, control, end, steps):
                    total += math.dist(previous, point)
                    previous = point
                current = end
                step += 4
            elif kind == "A":
                rx, ry, rotation, large_arc, sweep, x, y = values[step : step + 7]
                end = (current[0] + x, current[1] + y) if relative else (x, y)
                previous = current
                for point in sample_arc(current, rx, ry, rotation, large_arc, sweep, end):
                    total += math.dist(previous, point)
                    previous = point
                current = end
                step += 7
            else:
                step = len(values)

        index += 1

    return total


def groups(svg: str) -> dict[str, float]:
    """Délky podle skupin — `CUT` (řez) a `ENGRAVE` (gravír)."""
    lengths: dict[str, float] = {}
    for match in re.finditer(r'<g id="([A-Za-z]+)">(.*?)</g>', svg, re.S):
        name, body = match.group(1), match.group(2)
        total = sum(path_length(d) for d in re.findall(r'<path d="([^"]+)"', body))
        lengths[name] = total
    return lengths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--svg", type=pathlib.Path, default=DEFAULT_SVG)
    parser.add_argument("--cut-speed", type=float, default=20.0, help="mm/s pro průchozí řez 3 mm")
    parser.add_argument("--engrave-speed", type=float, default=250.0, help="mm/s pro linkový gravír")
    parser.add_argument("--rate", type=float, default=600.0, help="Kč/hod provozu laseru (tržní sazba)")
    args = parser.parse_args()

    if not args.svg.exists():
        print(f"chybí SVG: {args.svg}", file=sys.stderr)
        return 1

    lengths = groups(args.svg.read_text())
    if not lengths:
        print("v SVG nejsou skupiny CUT/ENGRAVE", file=sys.stderr)
        return 1

    total_mm = sum(lengths.values())
    print(f"zdroj: {args.svg.name}")
    for name, length in sorted(lengths.items()):
        print(f"  {name:<8} {length / 1000:8.2f} m")

    cut = lengths.get("CUT", 0.0)
    engrave = lengths.get("ENGRAVE", 0.0)

    cut_seconds = cut / args.cut_speed
    engrave_seconds = engrave / args.engrave_speed
    seconds = cut_seconds + engrave_seconds

    print()
    print(f"délka celkem:  {total_mm / 1000:.2f} m (CUT {cut / 1000:.2f} m, ENGRAVE {engrave / 1000:.2f} m)")
    print(f"čas @ {args.cut_speed:.0f} mm/s řez / {args.engrave_speed:.0f} mm/s gravír: "
          f"{seconds / 60:.1f} min ({cut_seconds / 60:.1f} + {engrave_seconds / 60:.1f})")
    print(f"cena stroje @ {args.rate:.0f} Kč/h: {seconds / 3600 * args.rate:.0f} Kč")

    print()
    print("rozptyl (jiné rychlosti / sazby):")
    for cut_speed, engrave_speed, rate in [(14, 180, 600), (20, 250, 600), (30, 400, 900)]:
        sec = cut / cut_speed + engrave / engrave_speed
        print(f"  řez {cut_speed} mm/s, gravír {engrave_speed} mm/s, {rate} Kč/h → "
              f"{sec / 60:.1f} min, {sec / 3600 * rate:.0f} Kč")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
