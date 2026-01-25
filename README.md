# Squickr Life

> **Get shit done quicker with Squickr!**

A personal bullet journal app built with event sourcing, offline-first PWA architecture, and strict TDD principles.

## What Is This?

Squickr Life is a digital bullet journal designed to work seamlessly across your Android phone, iPad, and computer - all while being completely offline-capable with optional cloud backup.

Built with event sourcing from the ground up, every action is an event, and the entire application state can be reconstructed from the event log.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State Management**: Event Sourcing + CQRS
- **Storage**: localStorage (MVP), IndexedDB (planned)
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

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0 (install: `npm install -g pnpm`)

### Installation

```bash
# Install dependencies
pnpm install

# Run tests
cd packages/shared
pnpm test run

# Start dev server
cd packages/client
pnpm dev
# Opens browser to http://localhost:5173
```

## Current Status

**Domain Layer (Event Sourcing):** ✅ 100% Complete
- Task, Note, and Event command handlers
- EntryListProjection (unified read model)
- 188 tests passing

**Client UI:** ⚠️ ~40% Complete
- Task UI implemented
- Note and Event UI pending

**For detailed status, see:** [docs/current-status.md](docs/current-status.md)

## Returning After a Break?

New to the project or resuming after some time away?

1. **Read:** [docs/current-status.md](docs/current-status.md) - See what's implemented and what's next
2. **Check:** [docs/README.md](docs/README.md) - Documentation index
3. **Review:** [docs/development-guide.md](docs/development-guide.md) - How to work with the codebase

## Documentation

All documentation lives in [docs/](docs/):

- **[docs/README.md](docs/README.md)** - Documentation index
- **[docs/current-status.md](docs/current-status.md)** - Implementation status and next steps
- **[docs/development-guide.md](docs/development-guide.md)** - How to work with the codebase
- **[docs/opencode-workflow.md](docs/opencode-workflow.md)** - Working with OpenCode agents
- **[docs/architecture-decisions.md](docs/architecture-decisions.md)** - Design decisions and rationale
- **[docs/event-models.md](docs/event-models.md)** - Event sourcing patterns

## AI Agent Team

This project uses an **orchestrator pattern** with specialized agents:

### OpenCode (Orchestrator)
**Role:** Coordinates the team, delegates tasks, manages workflow
- Reads user requests and breaks them into tasks
- Delegates implementation to Speedy Sam
- Delegates reviews to Code-Review Casey
- Only writes code for trivial changes (typos, 1-2 line fixes)
- Reports progress and coordinates between agents

### 🎨 Model-First Morgan
**Role:** Event modeling & user experience design
- Designs event schemas and aggregates
- Creates user stories and workflows
- Ensures domain model matches real-world behavior

### ⚙️ Architecture Alex
**Role:** System design & SOLID principles
- Makes architectural decisions (documented as ADRs)
- Ensures SOLID principles are followed
- Designs system structure and patterns

### ✅ Test-First Terry
**Role:** TDD enforcement & test quality
- Ensures tests are written before implementation
- Reviews test coverage and quality
- Validates test patterns follow best practices

### 🔍 Code-Review Casey
**Role:** Quality assurance & refactoring
- Reviews all code before commits
- Identifies code smells and improvement opportunities
- Suggests refactoring when needed

### 🚀 Speedy Sam
**Role:** Implementation & bug fixes
- Writes production code following TDD
- Implements features designed by Morgan and Alex
- Fixes bugs and runs tests
- Reports completion back to orchestrator

## Working with OpenCode

**Key workflow:**
1. User requests feature
2. **OpenCode** delegates to **Speedy Sam** for implementation
3. **Sam** completes work → **OpenCode** says **"Ready for code review"**
4. User says **"review"** → **OpenCode** delegates to **Casey**
5. **Casey** provides feedback
6. User does manual testing
7. User says **"commit"** → **OpenCode** commits changes

**For details, see:** [docs/opencode-workflow.md](docs/opencode-workflow.md)

## Roadmap

### Phase 1: Entry Types MVP (In Progress)
- [x] Event store with localStorage
- [x] Task, Note, Event domain handlers
- [x] Unified EntryListProjection
- [ ] Entry type UI (Task, Note, Event)
- [ ] Drag-and-drop reordering

### Phase 2: Feature Expansion
- [ ] Daily logs and rapid logging
- [ ] Collections and indexes
- [ ] Task migrations (future log)

### Phase 3: Backend & Sync
- [ ] Supabase integration
- [ ] Google OAuth
- [ ] Real-time sync
- [ ] Conflict resolution

**For detailed status, see:** [docs/current-status.md](docs/current-status.md)

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
