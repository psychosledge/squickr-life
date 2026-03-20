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
- **[OpenCode Workflow](docs/opencode-workflow.md)** - Agent team and development loop
- **[Development Guide](docs/development-guide.md)** - How to implement features
- **[Architecture Decisions](docs/architecture-decisions.md)** - Design decisions (ADRs)

## Working with OpenCode

This project uses a **3-agent orchestrator pattern**:

- **⚙️ Alex** - Architecture & event modeling (`/design`)
- **🚀 Sam** - Implementation & debugging (`/implement`)
- **🔍 Casey** - Code review & test coverage (`/review`)

**Development loop:**
1. User requests feature
2. OpenCode delegates to Alex via `/design`
3. User approves the plan
4. OpenCode delegates to Sam via `/implement`
5. Sam implements with TDD → OpenCode calls Casey via `/review`
6. User does manual testing
7. User says "commit" → OpenCode creates commit

**For details:** [docs/opencode-workflow.md](docs/opencode-workflow.md)

See **[docs/](docs/** for additional documentation.

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
