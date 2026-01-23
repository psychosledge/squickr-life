# Learning Log

This document tracks your learning journey through building Squickr Life with agentic coding.

## How to Use This Log

After each **CHECKPOINT** in the project, we'll pause and reflect:
- What did you learn?
- What patterns did you notice?
- What questions came up?
- What concepts need more exploration?

This becomes your personal reference for event sourcing, CQRS, TDD, and agentic development.

---

## Session 1: Project Kickoff (2026-01-22)

### What We Built
- Monorepo structure with pnpm workspaces
- Package definitions for client, shared, backend
- Initial documentation structure

### Concepts Introduced

#### Monorepo Architecture
**What it is**: Single repository containing multiple related packages

**Why we chose it**:
- Share TypeScript types between client and backend
- Make changes to event schemas atomically across packages
- Simplify dependency management

**Key files**:
- `pnpm-workspace.yaml` - Defines which folders are packages
- Root `package.json` - Workspace-level scripts and config

#### pnpm Workspaces
**What it does**: Manages dependencies across multiple packages efficiently

**Commands to know**:
- `pnpm install` - Install all workspace dependencies
- `pnpm --filter client dev` - Run script in specific package
- `pnpm -r test` - Run script in all packages recursively

**Benefits**:
- Deduplicates dependencies across packages
- Strict mode prevents phantom dependencies (can't import what you didn't declare)
- Faster than npm/yarn

### Questions That Came Up
- How will event sourcing actually work? *(We'll see in next checkpoint)*
- What does Morgan's event modeling process look like? *(Coming in item 6)*
- How do we share types between packages? *(We'll set up in item 2)*

### Next Steps
- Configure TypeScript across all packages
- Set up Vitest for testing
- Initialize React with Vite and Tailwind

### Learning Resources
*Add any articles, videos, or docs you found helpful*

---

## Checkpoint Template (for future sessions)

### Session X: [Feature Name] (Date)

#### What We Built
- List what was implemented

#### Concepts Learned
- New patterns or techniques
- How they relate to SOLID principles
- Event sourcing insights

#### Code Patterns to Remember
```typescript
// Example code snippets you want to reference
```

#### Questions & Answers
- Questions that arose during implementation
- How they were resolved

#### Personal Reflections
- What clicked for you?
- What's still fuzzy?
- What do you want to explore more?

#### Agent Interactions
- How did each agent help?
- What did you learn from their different perspectives?

---

*Keep adding to this log after each checkpoint. It becomes your personal event sourcing handbook!*
