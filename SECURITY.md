# Data handling

This repository must not contain merchant business state.

Never commit:
- `state.sqlite3` or SQLite WAL/SHM files;
- historical product baselines;
- dHash cache exports;
- same-shop export history;
- generated merchant Excel files;
- logs containing local paths or operational data.

Persistent state belongs under `%LOCALAPPDATA%\WeidianMerchantTool\` on the user's machine.
