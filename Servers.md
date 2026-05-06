# Mainnet V3 — servery (premainnet / nasazení)

| Role        | Lokace    | IPv4               | Poznámka |
|-------------|-----------|--------------------|----------|
| Koordinátor | Helsinki  | `204.168.245.175` | Main server — genesis / první P2P listen |
| Node 1      | Singapur  | `5.223.62.255`    | Follower |
| Node 2      | USA       |  5.78.197.254    | V seznamu dříve stejná IP jako SG — každý uzel musí mít unikátní veřejnou IP |

SSH: stejný klíč v `~/.ssh` (na všech hostech).

**P2P seeding (greenfield):** na Helsinkách nechat `ZION_SEED_PEERS` prázdné; na SG a USA nastavit seed na `204.168.245.175:8333` (a **nikdy** neuvádět vlastní `host:8333` v seznamu seedů na daném stroji). Detail: `V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md` §7.
