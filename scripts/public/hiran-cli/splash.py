"""Genesis splash from docs/genesis.md — once, then a one-line status."""
import shutil
import sys
from pathlib import Path

from config import VERSION, load, signed_in

ART_PATH = Path(__file__).resolve().parent / "genesis_art.txt"
GOLD = "\033[33m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


def art_text():
    return ART_PATH.read_text(encoding="utf-8").strip("\n")


def split_art(text=None):
    lines = (text if text is not None else art_text()).splitlines()
    idx = 0
    for i, line in enumerate(lines):
        if "█" in line:
            idx = i
            break
    tree = "\n".join(lines[:idx]).strip("\n")
    mark = "\n".join(lines[idx:]).strip("\n")
    return tree, mark


def render(narrow=False):
    tree, mark = split_art()
    if narrow or not tree:
        body = mark
    else:
        body = tree + "\n\n" + mark
    return body + "\n\nGENESIS\n"


def use_color():
    if os_no_color():
        return False
    return sys.stdout.isatty()


def os_no_color():
    import os

    return os.environ.get("NO_COLOR", "") != ""


def paint(text):
    if not use_color():
        return text
    return GOLD + text + RESET


def splash(stream=None):
    stream = stream or sys.stdout
    narrow = False
    if stream.isatty():
        cols = shutil.get_terminal_size((100, 24)).columns
        narrow = cols < 100
    stream.write(paint(render(narrow=narrow)))
    stream.write("\n")
    stream.write(BOLD + "  Zion Hiran  " + RESET + VERSION + "\n" if use_color() else "  Zion Hiran  " + VERSION + "\n")
    cfg = load()
    stream.write("  Hiranyagarbha  ·  EU inference  ·  %s\n\n" % cfg["market"])
    stream.flush()


def status_line(session, cfg=None):
    cfg = cfg or load()
    who = "signed in" if signed_in(cfg) else "signed out"
    plan = session.plan or "—"
    mode = "agent" if session.agent else "chat"
    cwd = session.cwd
    return "  %s  ·  %s  ·  plan %s  ·  %s  ·  %s" % (cfg["model"], who, plan, mode, cwd)
