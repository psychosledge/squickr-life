# Mission: v1.13.1 Habit UI Polish + Pre-existing Type Fixes

## M1: Design ✅
- [x] T1.1: Alex designed the three UI fixes (FrequencyPicker extract, habit edit UI, notification time wiring)

## M2: Fix pre-existing TypeScript/lint issues | parallel with M3
- [x] T2.1: Fix `collectionStatsFormatter.test.ts` — Note/Event test fixtures missing `collections` field
- [x] T2.2: Fix `collection.projections.test.ts` — `Object is possibly 'undefined'` (20+ instances), direct array index access without null guard
- [x] T2.3: Fix `collection-management.test.ts` — `Object is possibly 'undefined'` + unused variables (`task2`, `taskId`)
- [x] T2.4: Fix `habit.projection.test.ts` — `HabitFrequencyChanged` imported but never used; `otherDay` declared but never read

## M3: Implement UI fixes (TDD) | parallel with M2
- [x] T3.1: Extract `FrequencyPicker` component + tests (shared by Create and Edit)
- [x] T3.2: Wire Every-N-Days number input in `CreateHabitModal` + update tests
- [x] T3.3: Add edit UI to `HabitDetailView` (rename, frequency, archive) + tests
- [x] T3.4: Enable notification time in `CreateHabitModal` + update tests

## M4: Review | depends: M2, M3
- [ ] T4.1: Casey reviews all changes — quality, coverage, regressions

## M5: Commit | depends: M4
- [ ] T5.1: Full test suite passes, bump versions to 1.13.1, update CHANGELOG, commit
