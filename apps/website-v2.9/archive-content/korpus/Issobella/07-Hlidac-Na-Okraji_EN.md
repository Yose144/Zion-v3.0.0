# ISSOBELLA — Chapter 7: The watcher at the edge
## Guardian · L6 service — a daemon that only reads, and precisely therefore can watch faithfully

> *"The strongest guardian is the one who cannot open the gate."*

---

## The Story

At the edge of the settlement, where the last harbour lights ended and the road upward began, stood a watchtower. Not large — only tall enough that the whole road along which the stream headed for the sky could be seen from it.

In the tower lived a watcher they called **Strizh** — because he hardly moved, and yet nothing escaped him. His work was curious: he was not allowed to open anything, close anything, or send anything on. He might only **look and count**.

*"If I could open the treasury,"* he said to a newcomer who came to visit him, *"one weak morning would be enough and the whole well would be gone. This way you can catch me by the hand — and you will still find only a list of how much water flowed through. I cannot lie, because I have nothing to lie with."*

He pointed to the scrolls. *"I count every block that passes — and how much light rose up from it. The leadership can read it whenever they want. Scientists can read it when they wish. Anyone can verify it directly in the chain, because a block does not lie. I am only the second eyes — for those who do not want to look for themselves."*

*"And if something goes wrong?"*

*"Then I write that something went wrong. That is my whole power — and it is greater than it looks. A guardian who cannot steal cannot be bribed. A guardian who only reads cannot pass off a wish as a fact."*

The newcomer asked whether Strizh would one day like to fly up himself.

*"Me? No. I am the one who counts the fuel. When you fly, I will watch over the honesty of the road for you — from the ground, where I watch all the time."*

---

## What it means

**The `issobella tracker` is a tracker — and its read-only nature is the most important property of L6.** The daemon runs on Edge as `zion-*-service` (internal service) (HTTP API on the `internal port`, nginx proxy `/api/issobella/`), scans the coinbase and exposes: the fund balance, proposals, metrics. Port 8097 came into being because ZIS had taken 8096 — even such a trifle is documented in `StatusV3.md`.

What the watcher **can** do: read the blockchain, count the inflow to the L6 address, expose data to those who ask.

What the watcher **cannot** do — and that is the point: **spend**. Decision G10 keeps it in the mode "a public, auditable, read-only base". No automatic expenditure, no payout flow, no key to the treasury. The service is the guardian of the truth about the fund, not the administrator of the fund.

In the language of the series: **Strizh is the second eyes of the protocol.** The first eyes are the blockchain — immutable, immune to deception, incorruptible. The second eyes are the tracker — a service that reads the blockchain and translates it for people. Where other systems boast of how much they can do, L6 boasts of **how much it cannot**.

---

## Anchor of truth — verifiable facts

| Image / claim | State | Anchor |
|---|---|---|
| The `issobella tracker` daemon runs on Edge, service `zion-*-service` (internal service) | **LIVE** | `StatusV3.md` (service table: port 8097, 127.0.0.1, "active — fund tracker live on Edge") |
| HTTP API on the `internal port`, nginx proxy `/api/issobella/` | **LIVE** | `StatusV3.md` 2026-08-23 (port 8097 because of a conflict with ZIS on 8096) |
| The tracker scans the coinbase and exposes the balance / proposals / fund metrics | **LIVE** (read-only) | the `internal repository` (sources + the `internal repository`, the `internal repository`) |
| The tracker can pay out / sign expenditures | **INVALID CLAIM** | G10: read-only mode; no automatic disposition |
| A public portal / dashboard of L6 data | **BUILDING** | The dashboard (`ZION_OS/dashboard/app.py`, `MissionControlDashboard`) shows L6 metrics to operators; public access is missing |
| API-key enforcement | **BUILDING** | Listed as missing in the README of this book (cf. BodhiGaia) |
| The figure of Strizh, "the tower at the edge of the settlement" | **MYTH** | A narrative stylisation for this book |

---

*"A guardian who only reads cannot pass off a wish as a fact."*

**Navigation:** [← Chapter 6: Five per cent upward](./06-Pet-Procent-Nahoru.md) · [Chapter 8: The mirror →](./08-Zrcadlo.md)
