# ADR-009: Bullet Journal Icon System

**Date**: 2026-01-29  
**Status**: Accepted

## Context
Bullet journal methodology uses symbols (bullets) to distinguish entry types and states:
- Tasks: • (incomplete), × (complete), > (migrated), – (irrelevant)
- Notes: – (dash)
- Events: ○ (circle)

Users familiar with BuJo expect these visual indicators.

## Decision
Implement dynamic icon system that maps entry type + state to BuJo symbols:
- Task incomplete: • (bullet)
- Task complete: × (cross)
- Task migrated: > (arrow)
- Task cancelled: – (dash)
- Note: – (dash)
- Event: ○ (circle)

Icons rendered via `getBulletIcon(entry)` helper function using discriminated union type narrowing.

## Rationale
- **Visual Recognition**: Symbols provide instant entry type/state recognition
- **BuJo Standard**: Matches physical bullet journal conventions
- **Type-Safe Mapping**: TypeScript ensures all entry types handled
- **Simple Implementation**: Pure function, no state needed

## Consequences
**Positive:**
- Authentic bullet journal experience
- Instant visual scanning (no need to read text)
- Type-safe exhaustive checking
- Accessibility: Icons have ARIA labels

**Negative:**
- Symbols may be unfamiliar to non-BuJo users (mitigated: tooltip/legend)
- Icon unicode may render differently across platforms (tested: consistent in modern browsers)

## SOLID Principles
- **Single Responsibility**: Icon mapping separated from rendering logic
- **Open/Closed**: Add new entry states without modifying existing mappings
