# Architecture — v2.6+

## Sources of truth

| Concern | Source of truth | Lifecycle |
|---|---|---|
| Source code / versions | GitHub | permanent |
| Historical version packets | GitHub `archive/version-packets` | permanent / review-only |
| Runtime package | Release ZIP | replaceable / deletable |
| Product history | `state.sqlite3` | permanent user data |
| SKU identities | `state.sqlite3` | permanent user data |
| Main-image dHash cache | `state.sqlite3:image_hashes` | permanent user data |
| Same-shop source history | `state.sqlite3:global_history` | permanent user data |
| State-change audit | `state.sqlite3:events` | append-only |
| Run ledger | `state.sqlite3:runs` | permanent operational history |
| Export/mall-confirmation ledger | `state.sqlite3:export_batches` | permanent operational history |
| Scan checkpoints | `%LOCALAPPDATA%/.../cache` | disposable |
| Daily / checkpoint backups | `%LOCALAPPDATA%/.../backups` | recoverability |
| Excel outputs | Documents/微店商品导出器/每日导出 | user deliverables |

## Runtime layout

```text
GitHub
  └─ source / tests / docs / compact history packets

Release ZIP (stateless)
  └─ runtime / scripts / config examples

%LOCALAPPDATA%\WeidianMerchantTool\
  ├─ data\state.sqlite3
  ├─ data\health_anchor.json
  ├─ backups\state_YYYY-MM-DD.sqlite3
  ├─ backups\checkpoint_*.sqlite3
  ├─ cache\...
  └─ logs\...
```

## Upgrade contract

1. Program folders never own persistent business state.
2. Release ZIPs never contain `.git`, `state.sqlite3`, user historical baselines, dHash user cache, same-shop history, or merchant Excel outputs.
3. v2.5 performs the one-time fixed-history-center import only when SQLite is not initialized.
4. v2.6+ open the same database directly; schema changes are idempotent in-place migrations.
5. If persistent state cannot be found/opened safely, fail closed rather than silently resetting.
6. State health is checked at startup.
7. Known historical high-water marks must not silently decrease.
8. Recovery is explicit: preserve the current database as an emergency backup before replacing it from a known-good backup.

## Dedupe evidence flow

```text
candidate
  ↓
exact IDs / SKU / product codes
  ↓
hard-spec extraction and conflict veto
  ↓
normalized title
  ↓
character-level fuzzy comparison
  ↓
main-image dHash evidence
  ↓
DUPLICATE_CONFIRMED / NEW_CONFIRMED / REVIEW_REQUIRED
```

Important: image similarity never overrides a hard-spec conflict.

## Search vs. dedupe boundary

```text
search: high recall
natural-language target → category route → fuzzy rank → human selection

identity: high precision
selected item → full detail/SKU → complete historical comparison → three-state verdict
```

## v2.6 state-correctness layer

- `runs` records target/new counts, deep-checked counts, history before/after and success state.
- `export_batches` records each prepared Excel batch separately from mall-import confirmation.
- product high-water metadata and an external health anchor guard against silent state regression.
- `quick_check` and foreign-key checks guard SQLite integrity.
- checkpoint/daily backups enable explicit recovery.
