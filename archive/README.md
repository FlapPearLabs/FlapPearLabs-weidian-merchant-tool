# Historical Version Packets

This directory exists for **project history and portfolio review**, not as the distribution channel for production binaries.

## Why compact packets instead of every full ~47MB release?

Historical runtime packages repeatedly bundled the same Node executable and dependency tree. Committing every full binary package would add roughly 800MB of duplicate runtime content and make the repository harder to review.

Instead, each formal project version has a **compact version packet ZIP** containing:

- milestone/version notes;
- original local artifact filename, size and SHA256;
- source/config file index from that release.

The current repository source remains on `main`; the packets preserve artifact identity and evolution evidence without duplicating full runtimes or user state.

These packets are **not runnable releases**.

## Versions

| Packet | Milestone |
|---|---|
| `v1.0` | specified-category exporter |
| `v1.1` | multi-mode discovery + global history |
| `v1.2` | keyword OR + launcher stability |
| `v1.3` | clean upload artifact |
| `v1.4` | real mall-contract golden format |
| `v1.5` | latest-product workflow |
| `v1.6` | `addTime` ordering |
| `v1.7` | category+latest + retry/checkpoint |
| `v1.8` | low-frequency / request-budget control |
| `v1.9` | five-layer entity dedupe |
| `v2.0` | dynamic baseline + duplicate-spec fix |
| `v2.1` | true N-new incremental acquisition |
| `v2.2` | multi-target fuzzy search + selection |
| `v2.3` | category router + persistent history center |
| `v2.4` | single-screen selector UX |
| `v2.5` | GitHub + external SQLite state architecture |
| `v2.6` | ledgers, health checks, checkpoints, recovery |

See `MANIFEST.md` for packet and original-local-artifact hashes. See `docs/PROJECT_EVOLUTION.md` and `docs/DECISION_LOG.md` for the narrative behind each transition.
