# Changelog

## v2.5.0

- Establish GitHub as the source-code/version source of truth.
- Establish `%LOCALAPPDATA%\WeidianMerchantTool\data\state.sqlite3` as the single persistent business-state source of truth.
- Move product history, image dHash cache, and same-shop history into SQLite.
- One-time import from the old fixed `%LOCALAPPDATA%\WeidianMerchantTool\历史中心` only; no sibling-version discovery.
- Remove bundled historical baseline seeds from release packages to prevent state rollback and data leakage.
- Release ZIPs contain no `.git`; old program folders can be deleted after the new version is validated.
- Keep daily SQLite backups and fail closed if first-run history is missing.
