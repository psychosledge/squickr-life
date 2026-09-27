# Squickr Life

Event-sourced bullet journal PWA. See `README.md` for setup and the documentation index.

## Development Loop

### Feature / design work

```
/brainstorm → [explicit approval] → /plan → [explicit approval] → /slice (repeat) → /ship
```

### Bug fixes

```
fix with a regression test → /code-review → commit
```

If a bug reveals a structural problem, escalate to `/brainstorm` → approve → `/plan` → `/slice` → `/ship`.

### Commands

- `/brainstorm`: exploratory design with the architect. Produces a design or problem summary that must be explicitly approved before proceeding
- `/plan`: decompose an approved design into thin vertical slices with acceptance criteria and UAT checklist. Human approves before any slice begins
- `/slice`: execute one slice: architect check → coder (TDD) → verifier → human approval gate before commit
- `/code-review`: verify correctness, walk through changes with the human, handle fixes, and commit
- `/ship`: run all tests, bump version, commit, tag, push, deploy Firebase Functions if changed

### On-demand utilities

- `/story` — draft a PM-readable story card; not part of the dev loop

> **Approval gates are non-negotiable.** Every phase transition requires explicit human approval — never infer consent from silence or context.

## Branching

- Model: trunk-based
- Trunk: master
- Feature branches: no
- CI runs on every push to `master`. Pushing a `v*` tag deploys to production.

## PR Platform

- Platform: GitHub

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
└── client/         # React PWA
functions/          # Firebase Cloud Functions
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
- ADR format for architectural decisions (one file per ADR in `docs/adr/`)

## Key Files

- `packages/domain/src/task.types.ts` — all event/command types (source of truth)
- `docs/adr/` — architecture decision records, one file per ADR
- `docs/weeks/` — current week's README holds active work and priorities
