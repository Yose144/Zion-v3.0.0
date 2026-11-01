#!/usr/bin/env bash
# edge-pool-probe.sh — read-only sonda pro fencing (běží NA PRIMÁRU, EDGE).
#
# Instaluje se na EDGE a váže se v /root/.ssh/authorized_keys pomocí
# `command="..."`, takže klíč z EDGE2 **neumí nic jiného** než tenhle skript.
# Přijímá libovolný vstup (ignoruje ho) a vrací jediné tři fakta, která
# fencing guard potřebuje k rozlišení „mrtvý" vs „jen wedged":
#
#   unit=active|inactive|failed|...   systemd stav zion-v31-pool
#   proc=0|1                          existuje proces zion-pool?
#   timer=active|inactive|...         běží zion-v31-watchdog.timer (auto-restart)?
#
# Nic nemění, nic nespouští, žádné argumenty neinterpretuje.
set -uo pipefail

unit="$(systemctl is-active zion-v31-pool 2>/dev/null || true)"
timer="$(systemctl is-active zion-v31-watchdog.timer 2>/dev/null || true)"
if pgrep -af 'zion-pool' >/dev/null 2>&1; then proc=1; else proc=0; fi

printf 'unit=%s\nproc=%s\ntimer=%s\n' "${unit:-unknown}" "$proc" "${timer:-unknown}"
