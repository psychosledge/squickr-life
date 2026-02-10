# Squickr Life

> **Get shit done quicker with Squickr!**

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
# Opens browser to http://localhost:5173
```

## Documentation

See **[docs/README.md](docs/README.md)** for full documentation index.

Key docs:
- **[OpenCode Workflow](docs/opencode-workflow.md)** - Agent team and development loop
- **[Development Guide](docs/development-guide.md)** - How to implement features
- **[Architecture Decisions](docs/architecture-decisions.md)** - Design decisions (ADRs)
- **[Event Models](docs/event-models.md)** - Event sourcing reference

## Working with OpenCode

This project uses a **3-agent orchestrator pattern**:

- **⚙️ Alex** - Architecture & event modeling (`/design`)
- **🚀 Sam** - Implementation & debugging (`/implement`)
- **🔍 Casey** - Code review & test coverage (`/review`)

**Development loop:**
1. User requests feature
2. OpenCode delegates to Sam via `/implement`
3. Sam implements with TDD → OpenCode calls Casey via `/review`
4. User does manual testing
5. User says "commit" → OpenCode creates commit

**For details:** [docs/opencode-workflow.md](docs/opencode-workflow.md)

## Current Status

**✅ Phase 1: PWA Deployment** - Installable, offline-first mobile app  
**✅ Phase 2: Mobile UX Polish** - FAB workflow, dark mode, mobile-optimized interactions  
**✅ Phase 3: Collections** - Full Collections feature with navigation (Phases 1A-2D complete)  
**✅ Phase 4: Firebase Sync** - Multi-device cloud sync with Google authentication
**✅ Phase 5: Clean Architecture** - Domain/infrastructure split, Firebase refactoring

**Latest Updates (Session 4 - Feb 7, 2026):**
- ✅ Clean Architecture refactoring (domain/infrastructure packages)
- ✅ Firebase moved to infrastructure layer following Dependency Inversion
- ✅ FirestoreEventStore implements IEventStore interface
- ✅ 1,118 tests passing (417 domain + 16 infrastructure + 685 client)
- ✅ Deployed to production at squickr.com

## What's Next

**Potential Future Enhancements:**
1. **Advanced Collection Features** - Filtering, search, templates, bulk operations
2. **Calendar Integration** - Daily log views with calendar navigation
3. **Habit Tracking** - Recurring tasks and habit charts
4. **Export/Import** - Backup and restore functionality

See **[docs/next-session-roadmap.md](docs/next-session-roadmap.md)** for detailed enhancement backlog.

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
