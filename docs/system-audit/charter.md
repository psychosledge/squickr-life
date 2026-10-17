# Squickr Life system audit charter

Started 2026-10-17 against `master` at `41d7b2c`.

## Scope

The squickr-life repo, reviewed as one system:

- `packages/domain`: event types, handlers, projections, snapshots
- `packages/infrastructure`: IndexedDB, Firestore and in-memory event and snapshot stores
- `packages/client`: React PWA, sync manager, cold-start sequencing, FCM
- `functions/`: scheduled reminder fan-out Cloud Functions
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.github/workflows/`

## Audience and use

The owner, who is the sole developer and sole user. The register informs what to fix next, weighted toward sound architecture and maintainability. Stated priorities:

- SOLID principles
- Event-sourcing best practice
- Cross-device divergence: two devices both appear fully up to date while holding very different state

The system should support more users even though none are planned.

## Meaning of ready

Two devices that both appear up to date hold the same state, and the architecture is maintainable enough that the next fixes are straightforward. No numeric targets were given, so no numbers or targets appear in any output.

## Environments

| Environment | Access | Read-only | Representativeness |
|---|---|---|---|
| Local unit test suites (vitest, jest) | `pnpm -r test`, `cd functions && npx jest` | Yes. Firebase modules are mocked globally in client setup, infrastructure tests mock Firestore and use fake-indexeddb, functions tests inject fakes | Logic only. No real Firestore, network or multi-device behavior |
| Firebase project `squickr-life` | Production. Local dev also talks to it (known backlog item #22) | Not used | Production. Never touched by this audit |

Baseline 2026-10-17 at `41d7b2c`: client 1721 tests in 106 files pass, functions 68 tests in 4 suites pass, domain 1004 tests in 44 files pass, infrastructure 139 tests in 6 files pass (rerun by agent D). No skipped or focused tests.

There is no emulator and no dev or test Firebase project. Evidence is limited to reading code and running the unit suites.

## Ownership boundaries

Firebase (Auth, Firestore, Cloud Functions, FCM) is the only external dependency. It is described by its current definition only. Hosting is GitHub Pages via `.github/workflows/deploy.yml`.

## In-flight work

Release `docs/tracking/2026-10-16-habits-and-sync/` (in scope). Active items include habit schedule history (slice 3 pending), stale state on reload of an existing device, and snapshot fallback on an invalid local snapshot.

## Excluded sources

- `docs/tracking/` except `docs/tracking/2026-10-16-habits-and-sync/`
- `docs/stories/`

## Rules

- Treat ADRs, comments, READMEs, the backlog, status documents and existing patterns as claims to test. Check a status document against code or a run before quoting it.
- Every finding cites file and line or a measurement and states its evidence level: read, measured or inferred. Inferred findings say what would confirm them.
- Agent reports are candidates. Agreement between agents is a signal, never proof.
- No numbers or targets without a source.
- Label environment representativeness on every measurement. Do not size production from local data.
- Do not use credentials found in config or env files. Do not open `.env.local` or `.env.production`.
- Do not run anything against production. Ask before any measurement that adds load or touches a shared system.
- Read-only on the repository. The only writes are inside `docs/system-audit/`. Nothing is committed unless the owner asks.
- Never push. Never include secret values in any output.
- One theme and one decision at a time.
- Writing style: no em dashes, no contrast constructions, no verdicts appended to facts.

## Lenses

Selected: L1 contracts and boundaries, L2 variant divergence, L3 failure modes, auth and configuration, L4 performance and cost, L5 untested behavior, L6 observability and deploy, L8 structure and change cost, L9 dependencies, L10 data and privacy, L11 frontend quality, L12 concurrency, idempotency and time, L14 event sourcing and replication (added to the lens library for this audit).

Skipped: L7 LLM behavior (no model calls in the repo), L13 documentation and handoff (sole long-term owner, no ownership change).

Agent groups:

| Agent | Lenses | Output |
|---|---|---|
| A | L1, L2 | `pass1/01-boundaries-variants.md` |
| B | L12, L10, L4 | `pass1/02-concurrency-data-cost.md` |
| C | L3, L6, L9 | `pass1/03-failure-ops-deps.md` |
| D | L5 | `pass1/04-untested-behavior.md` |
| E | L8, L11 | `pass1/05-structure-frontend.md` |
| F | L14 | `pass1/06-event-sourcing-replication.md` |

## Status

- [x] Step 1 intake (saved as `system-audit-config` project memory)
- [x] Step 2 preflight
- [x] Step 3 charter
- [x] Step 4 pass 1 evidence (six reports in `pass1/`)
- [x] Step 5 consolidate (`pass1/00-consolidated-candidates.md`)
- [x] Step 6 pass 2 verify and walk through (30 findings agreed)
- [x] Step 7 pass 3 in-flight overlap (`register-working.md` "In-flight overlap")
- [x] Step 8 register (owner approved 2026-10-17 with no changes)
- [x] Step 9 close out (release tracker rows updated, scratch probes deleted)

## Resume

Pass 1 complete 2026-10-17. Pass 2 walkthrough in progress, theme order T1 to T10 per `pass1/00-consolidated-candidates.md`. Scratch probes in `pass1/scratch/` are deleted at close-out. Pass 2 and pass 3 complete. `register.md` drafted (30 findings, final numbers map W1 to 1, W2 to 2, W3 to 3, W6 to 4, W11 to 5, W12 to 6, W4 to 7, W5 to 8, W7 to 9, W15 to 10, W13 to 11, W8 to 12, W16 to 13, W17 to 14, W19 to 15, W20 to 16, W21 to 17, W23 to 18, W24 to 19, W25 to 20, W27 to 21, W9 to 22, W10 to 23, W14 to 24, W18 to 25, W22 to 26, W26 to 27, W28 to 28, W29 to 29, W30 to 30). Owner approved the register 2026-10-17. Audit complete.

Re-verify later: finding 3 after habit-schedule slice 3 lands; finding 2 if the snapshot-fallback work lands first; findings 16 and 20 confirmed by owner checks on 2026-10-17 (see `verification-log.md`). Before reusing any citation, check commits after `41d7b2c`.
