# Squickr Life Documentation

Quick navigation to find what you need.

## 📚 Core Documentation

| Doc | Purpose | When to Read |
|-----|---------|--------------|
| **[Main README](../README.md)** | Project overview, setup, quick start | First time or showing others |
| **[OpenCode Workflow](opencode-workflow.md)** | Agent team, slash commands, development loop | Every session (orchestrator guide) |
| **[Development Guide](development-guide.md)** | TDD workflow, testing patterns, common tasks | When implementing features |
| **[Architecture Decisions](architecture-decisions.md)** | Design decisions and rationale (ADRs) | When making design choices |
| **[Event Models Reference](event-models.md)** | Quick event sourcing reference | When designing new events |
| **[Roadmap](roadmap.md)** | Version history and upcoming features | Planning next work |
| **[Deployment Guide](deployment-guide.md)** | Release process and validation | Before merging to production |

## 📦 Archive

Completed feature designs (for reference):
- [Archive: Designs](archive/designs/) - Sub-tasks, backend sync, collections implementation plans

---

## 🎯 Quick Navigation

### Starting a New Session
1. Check git log: `git log --oneline -10`
2. Read: **[OpenCode Workflow](opencode-workflow.md)** - Remember the agent team
3. Say to OpenCode: *"What did we do so far?"*

### Implementing a Feature
1. Read: **[Development Guide > Common Tasks](development-guide.md#common-tasks)**
2. Use: `/design` or `/implement` slash commands
3. Follow: The development loop (Design → Implement → Review → Commit)

### Making Architecture Decisions
1. Read: **[Architecture Decisions](architecture-decisions.md)** - See existing patterns
2. Use: `/design [question]` slash command
3. Alex will create ADR

### Understanding Event Sourcing
1. Read: **[Event Models Reference](event-models.md)** - Quick patterns
2. Check: `packages/domain/src/task.types.ts` - Full TypeScript definitions
3. Read: **[Architecture ADR-002](architecture-decisions.md#adr-002-event-sourcing-with-cqrs)** - Why we chose this

---

## 🗂️ What's in Each Doc?

### README.md (Main)
- What is Squickr Life?
- Tech stack
- Quick start commands
- Project goals

### opencode-workflow.md
- **The agent team:** Alex (design), Sam (implementation), Casey (review)
- **Slash commands:** `/design`, `/implement`, `/review`
- **The development loop:** Design → Implement → Review → User test → Commit
- **Communication patterns:** How to work with agents
- **Essential reading for every session**

### development-guide.md
- Project structure
- TDD Red-Green-Refactor workflow
- Testing patterns (handlers, projections, React)
- Common tasks (adding handlers, aggregates)
- Event sourcing best practices

### architecture-decisions.md
- ADR-001: Monorepo with pnpm
- ADR-002: Event sourcing with CQRS
- ADR-003: IndexedDB persistence
- ADR-004: Separate events per aggregate
- ADR-005: Discriminated unions
- ADR-006: Reactive projections
- ADR-007: Daily logs view

### event-models.md
- Quick event sourcing reference
- Event naming conventions
- Aggregate types (Task, Note, Event)
- Projection patterns
- Points to TypeScript source for full schemas

---

## 📊 Documentation Philosophy

**Lean and current:**
- No duplicate information
- Code is the primary documentation
- Docs explain "why", code shows "how"
- Update docs when patterns change

**Removed (to reduce noise):**
- `current-status.md` - Replaced by git log
- `learning-log.md` - Unused template

**What we DON'T document:**
- Implementation status (see git commits)
- Detailed how-to for every scenario (code is self-documenting)
- Session notes (use git log)

---

## 🔍 Finding Things

**"How do I implement X?"**
→ [Development Guide > Common Tasks](development-guide.md#common-tasks)

**"Why did we choose Y?"**
→ [Architecture Decisions](architecture-decisions.md)

**"What events exist?"**
→ `packages/domain/src/task.types.ts` (source of truth)  
→ [Event Models Reference](event-models.md) (quick summary)

**"What's the agent workflow?"**
→ [OpenCode Workflow](opencode-workflow.md)

**"What did we work on recently?"**
→ `git log --oneline -10`

---

## 🛠️ Maintaining Docs

**Update when:**
- Architecture decisions change → Update ADRs
- New patterns emerge → Update development guide
- Agent workflow changes → Update opencode-workflow.md
- New aggregate types added → Update event-models.md

**Don't update for:**
- Feature implementation progress (that's in git)
- Bug fixes (that's in commit messages)
- Test counts (run `pnpm test run` to see current)

---

## External Resources

- [Event Sourcing (Martin Fowler)](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Bullet Journal Method](https://bulletjournal.com/pages/learn)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Vitest](https://vitest.dev/)

---

**Last Updated:** 2026-02-11  
**Maintainer:** OpenCode + User
