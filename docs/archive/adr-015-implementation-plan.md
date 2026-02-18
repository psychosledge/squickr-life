# ADR-015 Implementation Plan: "Entries Appear on Collections" Model

**Date**: 2026-02-14  
**Status**: ⚠️ **SUPERSEDED** — Replaced by actual implementation (see ADR-015 in `architecture-decisions.md`)  
**Actual Implementation**: 5 phases completed in ~12 hours (2026-02-15)

---

## ⚠️ This document is superseded

The original 8-phase plan was not followed. The team took a different 5-phase approach that focused on:

1. **Fixing critical Issue #7G first** (collection history preservation)
2. **Deferring full terminology refactor** (Task→Entry) to future work
3. **Incremental 5-phase approach** instead of the planned 8 phases

For the actual implementation details, see:
- **ADR-015** in `docs/architecture-decisions.md`
- **CHANGELOG v0.10.0** — Complete implementation summary
- **Test files**: `multi-collection-integration.test.ts` (19 comprehensive tests)
