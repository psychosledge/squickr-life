# Backlog

Not-yet-started work. List order is priority, top first. `#N` is a permanent ID in the order items were identified; it never changes and is never reused. Items move to the live release's README when scheduled. A `~` date is approximate.

Types: bug, feature, ux, debt.

- #1 feature, habits: Habit view allows month navigation (~2026-06-30)
- #2 feature, habits: Habits can be toggled in the habit view on unscheduled days (e.g. showered a day ahead of schedule) (~2026-06-30)
- #3 feature, habits: Habits have a per-habit setting for how long they stick when missed, or all stick for one day (~2026-06-17)
- #4 bug, habits: Streaks use the schedule in effect on each day, so editing a habit's schedule doesn't rewrite its past streak (2026-09-28)
- #5 debt, habits: Split `habit.projection.ts` (over 700 lines): schedule/date helpers and streak algorithms into their own modules; `applyHabitEvent` is over 70 lines. Split `habit.projection.test.ts` (over 1,500 lines) to match (2026-10-13)
- #6 bug, habits: Reminder index writes the uploaded event's `payload.frequency` (`habitReminderIndexWriter.ts:137-145`), so an older schedule change uploaded after a newer one leaves the reminder on the stale schedule. Use the projection's `habit.frequency` (2026-10-13)
- #7 debt, habits: `isScheduledToday` on the habit read model uses the current schedule and has no production consumer. Remove it, or compute it from the schedule in effect on `asOf` (2026-10-13)
- #8 bug, habits: Fixed daily and weekly habits are listed on daily logs from before their creation: `isScheduledOn` checks creation only for every-n-days (2026-10-13)
- #9 ux, migration: When migrating parents, children auto-select (~2026-06-10)
- #10 ux, migration: Migrate target list calendar order is newest to oldest (~2026-09-26)
- #11 feature, planning: Sprint-planning feel: the daily log holds only completable things; multistep work is broken down and only the doable part reaches the daily level. Exploration via `/brainstorm` (~2026-09-26)
- #12 feature, entries: Events and notes allow sub-entries. Blocked by #11 (~2026-07-07)
- #13 feature, entries: Notes and events can have reminders (2026-09-27)
- #14 ux, entries: Sub-entries are easier to add. Blocked by #11 (~2026-07-07)
- #15 feature, journaling: Daily wrap-up ritual prompts (what was fun, what was hard, what did you learn, what was important), with AI assistance based on [brag documents](https://jvns.ca/blog/brag-documents/) (~2026-03-03)
- #16 feature, search: Search with type selection and date range (~2026-07-07)
- #17 ux, collections: Completed and deleted entry lists show most recent first (2026-10-13)
- #18 feature, entries: Entries and collections have a history view showing past versions (e.g. recover a task's name after an accidental rename) (2026-10-13)
- #19 debt, client: Split `CollectionDetailView.test.tsx` (over 3,000 lines) by concern (2026-10-13)
- #20 bug, client: Flaky test: `useCollectionNavigation.test.tsx` "should navigate when horizontal swipe is clearly intentional (diagonal)" waits on `setTimeout(100)` and fails under full-suite load (2026-10-13)
- #21 bug, sync: Signing out doesn't clear the local IndexedDB stores (`squickr-events`, `squickr-snapshots`), which aren't scoped per user (`App.tsx:259-260`, `firebase/auth.ts:30`). Signing into another account in the same browser likely uploads the previous account's local events to it via `SyncManager` (2026-10-16)
- #22 feature, dev: Testing data namespace so local dev doesn't touch real data with the same login. Firestore paths use `testing-{uid}` in dev mode and the bare uid in production builds, via one helper at the `user.uid` call sites (`useColdStartSequencer.ts`, `App.tsx:434`). `firestore.rules` owner checks also allow `'testing-' + request.auth.uid`. Cloud Functions need no change. Open: phone access to dev (HTTPS dev server or a deployed testing build), and an Admin SDK script to reset, seed, or copy real events into the namespace. Exploration via `/brainstorm` (2026-10-16)
- #23 debt, tests: Test files aren't type-checked. Each package's tsconfig excludes them, and domain, infrastructure, and client tests have type errors. Mostly mechanical (unchecked index access, fixtures missing required fields, vitest globals without imports), but some may hide drift: call arity mismatches, stale `AppContextValue` and `CollectionHandlers` mocks, `pinnedCollectionIds` on `UserPreferences`, `HierarchyNode.date`/`.collection`. Fix per package, then gate each with a `tsconfig.test.json`, a `typecheck:test` script, and a CI step. The client already has an unused `tsconfig.test.json` whose `rootDir` excludes path-mapped package sources (2026-10-17)
- #24 bug, client: Flaky test: `EntryActionsMenu.test.tsx` "should handle clicks on sub-task menu when rendered with wrapper divs" fails intermittently in full-suite runs and passes in isolation (2026-10-17)
