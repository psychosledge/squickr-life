# Squickr Life Documentation

| Doc | Purpose |
|-----|---------|
| [Development Guide](development-guide.md) | Project structure, TDD workflow, testing patterns, common tasks |
| [Architecture Decisions](adr/) | ADRs: design decisions and rationale |
| [Deployment Guide](deployment-guide.md) | CI, tag-based release, production validation |
| [weeks/](weeks/) | Current week's README: active work and priorities. Past weeks in `weeks/archive/` |
| [stories/](stories/) | Per-story `plan.md` files from `/plan`. Finished stories in `stories/archive/` |

The development workflow and agent commands are defined in the root [CLAUDE.md](../CLAUDE.md).

Event and command types: `packages/domain/src/task.types.ts` (source of truth).
