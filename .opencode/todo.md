# Mission: v1.14.0 — Fix Ghost Active Task Count + Habit Notification Time in Settings

## Status: completed

## M1: Design (Alex) | status: completed
### T1.1: Bug 1 — Ghost active task on monthly log
- [x] S1.1.1: Identify exact scenario that produces ghost count (write failing test first) | size:M
- [x] S1.1.2: Design fix for getActiveTaskCountsByCollection | size:S

### T1.2: Bug 2 — Notification time missing in HabitDetailView Settings
- [x] S1.2.1: Design notification time UI addition (reference CreateHabitModal + SettingsModal) | size:S

## M2: Implement (Sam, TDD) | depends:M1
### T2.1: Bug 1 fix | agent:Sam
- [x] S2.1.1: Write failing test(s) reproducing the ghost active task count | size:M
- [x] S2.1.2: Fix getActiveTaskCountsByCollection (or whatever root cause is) | size:S
- [x] S2.1.3: All domain tests pass | size:S

### T2.2: Bug 2 fix | agent:Sam
- [x] S2.2.1: Write failing test for notification time in HabitDetailView | size:S
- [x] S2.2.2: Add notification time UI to HabitDetailView Settings section | size:S
- [x] S2.2.3: All client tests pass | size:S

## M3: Review (Casey) | depends:M2
- [x] T3.1: Casey reviews all changes — quality, coverage, regressions | size:M
- [x] T3.2: Full test suite passes (domain + client + functions) | size:S

## M4: Commit | depends:M3
- [x] T4.1: Bump versions to 1.14.0, update CHANGELOG, commit | size:S
