# Data Handling

[中文](SECURITY.md) | **English**

This public repository must not contain merchant business state.

Never commit:

- `state.sqlite3` or SQLite WAL/SHM files;
- historical product baselines;
- dHash cache exports;
- same-shop export/acquisition history;
- generated merchant Excel files;
- logs containing local paths or operational merchant data;
- user-specific shop configuration, cookies, tokens, or credentials;
- the inherited third-party client binary.

Persistent business state belongs under `%LOCALAPPDATA%\WeidianMerchantTool\` on the user's machine. Release packages are intended to be stateless and deletable.
