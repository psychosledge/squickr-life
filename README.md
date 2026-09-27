# Squickr Life

> **Get your shit together quicker with Squickr!**

A personal bullet journal app built with event sourcing, offline-first PWA architecture, and strict TDD principles.

## What Is This?

Squickr Life is a digital bullet journal designed to work seamlessly across your Android phone, iPad, and computer - all while being completely offline-capable with optional cloud backup.

Built with event sourcing from the ground up, every action is an event, and the entire application state can be reconstructed from the event log.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State Management**: Event Sourcing + CQRS
- **Storage**: IndexedDB (local), Firestore (cloud sync)
- **Authentication**: Firebase Auth (Google OAuth)
- **Testing**: Vitest, React Testing Library
- **Architecture**: Clean Architecture (domain/infrastructure/client)

## Project Structure

```
packages/
├── domain/          # Pure business logic & event sourcing (Clean Architecture core)
├── infrastructure/  # Storage implementations (IndexedDB, Firestore, InMemory)
└── client/          # React PWA (UI components, Firebase config/auth)
functions/           # Firebase Cloud Functions (push notification fan-out)
docs/                # Documentation
```

## Quick Start

```bash
pnpm install

# Firebase config: copy the template and fill in values from
# Firebase Console > Project Settings > General
cp packages/client/.env.example packages/client/.env.local

pnpm -r test         # run all tests
pnpm dev             # dev server at http://localhost:3000
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | Development workflow, agent commands, key rules |
| [Development Guide](docs/development-guide.md) | TDD workflow, testing patterns, common tasks |
| [Architecture Decisions](docs/adr/) | ADRs: design decisions and rationale |
| [Deployment Guide](docs/deployment-guide.md) | CI, tag-based release, rollback |
| [docs/weeks/](docs/weeks/) | Current week's README: active work and priorities |
| [docs/stories/](docs/stories/) | Per-story `plan.md` files from `/plan` |

## Learning Goals

This project is a hands-on exploration of:
- Event sourcing and CQRS patterns
- Test-driven development
- Offline-first PWA architecture
- Monorepo structure with pnpm workspaces

## License

MIT

---

**Built with event sourcing and TDD**
