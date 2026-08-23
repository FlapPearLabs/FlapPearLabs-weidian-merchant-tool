# Architecture — v2.5+

## Sources of truth

| Concern | Source of truth | Lifecycle |
|---|---|---|
| Source code / versions | GitHub | permanent |
| Runtime package | Release ZIP | replaceable / deletable |
| Product history | `state.sqlite3` | permanent user data |
| SKU identities | `state.sqlite3` | permanent user data |
| Main-image dHash cache | `state.sqlite3:image_hashes` | permanent user data |
| Same-shop history | `state.sqlite3:global_history` | permanent user data |
| State-change audit | `state.sqlite3:events` | append-only |
| Scan checkpoints | `%LOCALAPPDATA%/.../cache` | disposable |
| Excel outputs | Documents/微店商品导出器/每日导出 | user deliverables |

## Upgrade contract

1. Program folders never own persistent business state.
2. Release ZIPs never contain `.git`, `state.sqlite3`, legacy baseline JSON, dHash JSON, shop history JSON, or user Excel outputs.
3. v2.5 performs exactly one legacy fixed-center import when the SQLite DB is not initialized.
4. v2.6+ open the same DB directly. Schema changes are idempotent in-place DB migrations.
5. If persistent state cannot be found or opened safely, fail closed rather than silently resetting.
6. SQLite state is backed up daily (7 retained copies).

## SQLite schema

- `meta`: schema version, initialization markers, baseline header metadata.
- `products`: canonical dedupe entities (`item_json` preserves matcher payload).
- `image_hashes`: image URL → 64-bit dHash / failure cache.
- `global_history`: per-shop source item history.
- `events`: append-only state-change audit.
