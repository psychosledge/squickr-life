# ADR-003: IndexedDB for Local Event Store

**Date**: 2026-01-22  
**Status**: Accepted

## Context
Persist events locally in browser for offline-first PWA.

## Decision
Use IndexedDB as local event store persistence layer.

## Rationale
- **Browser Native**: No additional dependencies
- **Large Storage**: 50MB+ (far more than localStorage's 5-10MB)
- **Structured Data**: Can index by aggregate ID, timestamp, event type
- **Async API**: Non-blocking reads/writes
- **PWA Standard**: Recommended for offline-first apps

**Alternatives Rejected:**
- localStorage: Too small, synchronous, no indexing
- WebSQL: Deprecated
- File System Access API: Not widely supported

## Consequences
**Positive:**
- No external dependencies
- Works in all modern browsers
- Efficient queries by various criteria
- Supports transactions

**Negative:**
- More complex API than localStorage
- Need to handle browser storage quota
- Incognito mode has limited storage

## SOLID Principles
- **Dependency Inversion**: EventStore depends on IStorageAdapter interface
