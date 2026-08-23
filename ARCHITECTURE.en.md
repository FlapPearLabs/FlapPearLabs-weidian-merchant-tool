# Architecture — v2.6+

[中文](ARCHITECTURE.md) | **English**

## 1. Three lifecycles

| Concern | Source of truth | Lifecycle |
|---|---|---|
| Source / decisions / versions | GitHub | permanent |
| Runtime package | Release ZIP | replaceable / deletable |
| Merchant product identity | `state.sqlite3` | permanent user state |
| dHash cache | `state.sqlite3:image_hashes` | permanent derived state |
| Same-shop history | `state.sqlite3:global_history` | permanent user state |
| Run/export audit | SQLite `runs` / `export_batches` | append-oriented operational state |
| Scan checkpoints | `%LOCALAPPDATA%/.../cache` | disposable |
| Deliverable Excel | Documents/微店商品导出器/每日导出 | user artifact |

The program version directory never owns merchant truth.

## 2. Acquisition architecture

```text
shop URL
  ↓
lightweight list/category APIs
  ↓
[category / keyword / ID / latest / fuzzy]
  ↓
optional category routing
  ↓
candidate display / user selection
  ↓
selected item IDs only
  ↓
full detail + SKU + image evidence
  ↓
entity dedupe
  ↓
mall Excel
```

The light phase prefers `itemId`, `itemName`, `addTime`, and category metadata. The deep phase obtains SKU/spec/price/stock/detail/images only when needed. This supports real latest ordering, fuzzy discovery, and request-budget control.

## 3. Search is not dedupe

```text
Search — high recall
"what might the operator mean?"
        ↓
human selection
        ↓
Dedupe — high precision
"is this the same product entity already in history?"
```

Search may be fuzzy and approximate. Dedupe is conservative and may return `REVIEW_REQUIRED`.

## 4. Category routing

A thin rule-based routing layer extracts high-information product-type fragments and compares them with live shop category names.

```text
high confidence   → best category
medium confidence → top 1–2 categories
low confidence    → whole-shop fallback
```

It deliberately avoids brand→category hardcoding and does not decide final product identity.

## 5. Five-layer entity resolution

For a fully fetched candidate against historical entities:

1. **Exact evidence:** itemId / skuId / product code.
2. **Hard specs:** capacity, weight, quantity, size, color number, model. A conflict vetoes duplicate status.
3. **Normalized title:** Unicode/case/punctuation/unit normalization and selected noise removal.
4. **Character fuzzy:** 2/3-gram, character bag, edit/order tolerance.
5. **Image evidence:** normalized main-image URL and browser-Canvas 64-bit dHash/Hamming distance.

Final outcomes:

```text
DUPLICATE_CONFIRMED
NEW_CONFIRMED
REVIEW_REQUIRED
```

### Why dHash

A CDN URL is a locator, not image identity. Different URLs/files may decode to the same visual content. Existing Playwright/Chrome decodes JPEG/PNG/WebP, Canvas normalizes the image to 9×8 pixels, and Node derives a 64-bit dHash. No heavy computer-vision runtime is required.

## 6. Historical baseline construction

Historical mall Excel files are interpreted at product level, not row level:

```text
SKU/data rows
→ group into product/SPU entities
→ merge exact historical duplicates
→ canonical historical baseline
```

This is why 5,278 historical rows do not mean 5,278 products.

## 7. SQLite Schema 2

- `meta` — schema, initialization, internal high-water marks.
- `products` — canonical historical entities used by dedupe.
- `image_hashes` — image URL → 64-bit dHash / failure cache.
- `global_history` — per-shop source item identity history.
- `events` — state-change audit.
- `runs` — targets, scan/deep-check counts, duplicates/reviews/new, history before/after.
- `export_batches` — Excel batch and `PREPARED / MALL_IMPORTED` status.

## 8. Health and recovery

Startup verifies:

1. SQLite `quick_check`;
2. foreign-key integrity;
3. internal product high-water monotonicity;
4. external `health_anchor.json` against whole-database rollback.

Successful history advancement creates checkpoint backups; daily backups are retained separately. Explicit restore takes an emergency backup first and then intentionally resets the health anchor to the chosen recovery point.

**Failure policy:** fail closed rather than silently create an empty history.

## 9. Upgrade contract

1. v2.5 performed the one-time legacy JSON → SQLite transition.
2. v2.6+ open the same database directly.
3. Schema migrations are in-place and idempotent.
4. No sibling-version directory discovery.
5. Release ZIPs contain no `.git`, SQLite, historical product JSON, dHash user cache, or merchant Excel state.
