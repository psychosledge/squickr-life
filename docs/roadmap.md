# Product Roadmap
**Last Updated:** March 19, 2026  
**Current Version:** v1.9.0  
**Status:** Post-v1.9.0 — UAT Feedback Round 2 In Progress

> **Version history:** See `CHANGELOG.md` for all past releases.

---



**Roadmap Status:** v1.9.0 CI fixed — cleared for Round 2  
**Current Phase:** Round 2 (items #6 and #11)  
**Date:** March 18, 2026

> ✅ **CI fix complete (March 18, 2026):**
> 1. `FirestoreEventStore.appendBatch()` now notifies subscribers once per event (matching `InMemoryEventStore` and `IndexedDBEventStore`). Tests updated to assert correct per-event notification order. `v1.9.0` tag recut on commit `9053b11`.
> 2. **Bug #7 investigation complete** — code path is correct end-to-end. The menu item appears only when a task belongs to 2+ collections (i.e., the user has used "Also show in" / `mode=add` in the migrate dialog). No code bug. UAT procedure note: to see "Remove from this collection", first use the ➤ menu → "Move / Add to collection" → select "Also show in [target]" → confirm. Then open the menu on that same task from the source collection.

---

## Backlog — UAT Feedback (March 17, 2026)

Work is organized into three rounds by complexity and dependency.

---

### Round 1 — Bug fixes & quick wins (v1.9.x)

| # | Item | Type | Notes |
|---|------|------|-------|
| 1 | Sub-items should not count toward collection stats | Bug | Exclude entries with `parentEntryId` in `collectionStatsFormatter.ts` |
| 2 | Uncategorized collection appears in swipe nav | Bug | Exclude virtual Uncategorized from `buildNavigationEntries` in `useCollectionNavigation.ts` |
| 3 | Swipe nav from collection list starts at first calendar entry instead of first auto-fav | Bug | URL mismatch between collection index links and `navigationEntries` — first entry should be first auto-fav at its temporal URL |
| 5 | Clickable URLs in entry content | Improvement | Detect URLs in entry text; render as `<a>` tags in `TaskEntryItem` / note/event renderers |
| 7 | "Remove from this collection" menu item for multi-collection entries | Improvement | Show in `EntryActionsMenu` when `entry.collections.length > 1`; uses existing `TaskRemovedFromCollection` event — ✅ **Shipped in v1.9.0**. UAT note: requires task to be in 2+ collections (use "Also show in" mode in migrate dialog first) |
| 8 | Collection stats separated by type | Improvement | Monthly collections currently show `(N entries)`; extend breakdown (tasks/notes/events) to match daily/custom format |

---

### Round 2 — Improvements requiring new preferences or domain work (v1.10.x)

| # | Item | Type | Notes |
|---|------|------|-------|
| 6 | Calendar collections with active tasks optionally auto-favorited | Improvement | New `autoFavoriteCalendarWithActiveTasks` user preference; extends `isEffectivelyFavorited()` and Settings modal |
| 11 | Quick daily migration of incomplete tasks | Improvement | "Migrate all open tasks → Today" bulk action on collection detail; builds on `BulkMigrateEntriesHandler` |

---

### Round 3 — New features, design-first (v2.x)

| # | Item | Type | Notes |
|---|------|------|-------|
| 4 | AI-assisted journaling (brag document style) | New feature | Based on https://jvns.ca/blog/brag-documents/ — prompts for accomplishments, learnings, contributions. Needs Alex design: prompt storage, dedicated collection vs inline, cloud-only vs optional AI |
| 9 | Gamify getting things done | New feature | Points, streaks, achievements for completing tasks. Needs Alex design: new aggregate, new events, badge/counter UI |
| 10 | Habit tracking | New feature | Recurring entries with completion tracking. Significant new aggregate. Needs Alex design first |
