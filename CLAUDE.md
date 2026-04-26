# Squickr Life

Event-sourced bullet journal PWA. See `docs/README.md` for full documentation.

## Development Loop

Use the global agent workflow:

`/brainstorm` → `/story` → `/plan` → `/slice` → user tests → `/ship`

- `/brainstorm` — exploratory design with architect
- `/plan` — decompose story into thin vertical slices
- `/slice` — architect → coder → verifier (gates human approval before commit)
- `/ship` — run tests, bump version, tag, deploy

> Follow this loop for **all** changes, including small ones. Do not skip steps for "simple" tasks.

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
- **No commits without passing tests**

## Common Commands

```bash
pnpm -r test               # run all tests across all packages
pnpm -r test -- --watch    # watch mode
pnpm dev                   # start client dev server
```

## Design Outputs

When designing features or architecture, provide:

- Event model (if applicable)
- SOLID principle analysis
- Tradeoffs and alternatives considered
- ADR format for architectural decisions (reference `docs/architecture-decisions.md`)

## Key Files

- `packages/domain/src/task.types.ts` — all event/command types (source of truth)
- `docs/architecture-decisions.md` — ADR-001 through ADR-029
- `docs/roadmap.md` — what's shipped and what's next
