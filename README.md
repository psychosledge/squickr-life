# Squickr Life

> **Get shit done quicker with Squickr!**

A personal bullet journal app built with event sourcing, offline-first PWA architecture, and strict TDD principles.

## What Is This?

Squickr Life is a digital bullet journal designed to work seamlessly across your Android phone, iPad, and computer - all while being completely offline-capable with optional cloud backup.

Built with event sourcing from the ground up, every action is an event, and the entire application state can be reconstructed from the event log.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State Management**: Event Sourcing + CQRS
- **Storage**: IndexedDB (event sourcing persistence)
- **Testing**: Vitest, React Testing Library
- **Backend** (planned): Supabase, Google OAuth

## Project Structure

```
packages/
├── client/      # React PWA (UI components)
├── shared/      # Event sourcing domain logic
└── backend/     # Supabase functions (future)

docs/            # Documentation (see docs/README.md)
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
cd packages/shared && pnpm test run

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
**✅ Phase 4: UX Enhancements** - Background sync, task counts, collapse completed, user profile menu, page navigation

**Latest Updates (Session 3 - Feb 1, 2026):**
- ✅ User profile menu with Google photos and dropdown
- ✅ Page flipping navigation (keyboard shortcuts, swipe gestures)
- ✅ 776 tests passing (348 backend + 428 frontend)
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
