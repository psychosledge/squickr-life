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
├── client/          # React PWA (UI components, Firebase config/auth)
└── backend/         # Future server (Node.js + Firebase Admin SDK)

docs/                # Documentation (see docs/README.md)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
cd packages/domain && pnpm test run

# Start dev server
cd packages/client && pnpm dev
# Opens browser to http://localhost:3000
```

## Documentation

See **[docs/README.md](docs/README.md)** for full documentation index.

Key docs:
- **[Development Guide](docs/development-guide.md)** - How to implement features
- **[Architecture Decisions](docs/adr/)** - Design decisions (ADRs)

## Development Workflow

Development runs through Claude Code: `/brainstorm` → `/plan` → `/slice` → `/ship`, with a human approval gate at each step. See [CLAUDE.md](CLAUDE.md).

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
