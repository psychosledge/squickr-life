# Squickr Life

Event-sourced bullet journal PWA. See `docs/README.md` for full documentation.

## Development Loop

### Feature / design work

```
/brainstorm → [explicit approval] → /plan → [explicit approval] → /slice (repeat) → /ship
```

If requirements are still unclear after brainstorm, insert a spike before planning:

```
/brainstorm → [explicit approval] → /spike → [explicit approval] → /plan → ...
```

### Bug fixes

```
/bug → [explicit approval] → commit
```

If `/bug` reveals a structural problem, escalate: characterize → `/brainstorm` → approve → `/plan` → `/slice` → `/ship`.

### Commands

- `/brainstorm` — exploratory design with the architect; produces a design or problem summary that must be explicitly approved before proceeding
- `/spike` — time-boxed investigation to answer a specific question blocking planning; produces a findings report that must be explicitly approved before `/plan` is invoked
- `/plan` — decompose an approved design into thin vertical slices with acceptance criteria and UAT checklist; human approves before any slice begins
- `/slice` — execute one slice: architect check → coder (TDD) → verifier → human approval gate before commit
- `/bug` — characterize, architect check, coder fix with regression test, verifier, human approval gate before commit
- `/ship` — run all tests, bump version, commit, tag, push, deploy Firebase Functions if changed

### On-demand utilities

- `/story` — draft a PM-readable story card; not part of the dev loop

> **Approval gates are non-negotiable.** Every phase transition requires explicit human approval — never infer consent from silence or context.

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
