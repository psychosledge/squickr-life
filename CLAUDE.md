# Squickr Life

Event-sourced bullet journal PWA. See `docs/README.md` for full documentation.

## Agent Team

| Agent | Role | Invoke with |
|-------|------|-------------|
| **alex** | Architecture, event modeling, ADRs | `/design <topic>` |
| **sam** | Feature implementation (TDD) | `/implement <feature>` |
| **casey** | Code review, test coverage | `/review` |

**Development loop:** `/design` → user approves → `/implement` → `/review` → user tests → commit

## Tech Stack

- React 18 + TypeScript + Vite + Tailwind
- Event Sourcing + CQRS (no direct state mutation)
- IndexedDB (local) + Firestore (cloud sync)
- Firebase Auth (Google OAuth)
- Vitest + React Testing Library (strict TDD)

## Package Structure

```
packages/
├── domain/         # Pure business logic, event store, handlers, projections
├── infrastructure/ # IndexedDB + Firestore event store implementations
├── client/         # React PWA
└── backend/        # Firebase Cloud Functions
```

## Key Rules

- **Tests first** — Red-Green-Refactor, always
- **Events are immutable** — never mutate, always append
- **Events are past tense** — `TaskCreated`, not `CreateTask`
- **Validate in handlers** — not just in UI
- **UTC storage, local display** — use `isoToLocalDateKey()` for date grouping
- **No commits without passing tests** — Casey must sign off first

## Common Commands

```bash
pnpm test run              # run all domain tests
cd packages/domain && pnpm test run
cd packages/client && pnpm dev
```

## Key Files

- `packages/domain/src/task.types.ts` — all event/command types (source of truth)
- `docs/architecture-decisions.md` — ADR-001 through ADR-018
- `docs/roadmap.md` — what's shipped and what's next
