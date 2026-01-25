# Squickr Life Documentation

Welcome to the Squickr Life documentation. This index helps you find the right document for your needs.

## Quick Navigation

### Getting Started
- **[Main README](../README.md)** - Project overview, quick start, and basic concepts
- **[Current Status](current-status.md)** - What's implemented, what's next, session notes

### For Developers
- **[Development Guide](development-guide.md)** - How to work with the codebase
  - Project structure
  - Testing patterns
  - Common tasks
  - Troubleshooting

### For OpenCode Sessions
- **[OpenCode Workflow Guide](opencode-workflow.md)** - How to work with OpenCode agents
  - Code review cycle
  - Agent types and usage
  - Communication patterns
  - Session recovery

### Architecture
- **[Architecture Decisions (ADRs)](architecture-decisions.md)** - Design decisions and their rationale
  - Event sourcing architecture
  - Monorepo structure
  - Entry type design
- **[Event Models](event-models.md)** - Event sourcing patterns and examples

### Other
- **[Learning Log](learning-log.md)** - Lessons learned during development

---

## Document Index by Purpose

### "I'm starting a new coding session"
1. Read: **[Current Status](current-status.md)** - See what's done and what's next
2. Check: **[Development Guide](development-guide.md)** - Remind yourself of common tasks
3. Review: **[OpenCode Workflow](opencode-workflow.md)** - Understand the development cycle

### "I want to understand the architecture"
1. Read: **[Architecture Decisions](architecture-decisions.md)** - Understand design choices
2. Read: **[Event Models](event-models.md)** - Learn event sourcing patterns
3. Read: **[Development Guide](development-guide.md)** - See how it's implemented

### "I need to implement a feature"
1. Read: **[Development Guide](development-guide.md)** - Find the "Common Tasks" section
2. Check: **[Architecture Decisions](architecture-decisions.md)** - Ensure you follow established patterns
3. Follow: **[OpenCode Workflow](opencode-workflow.md)** - Use the code review cycle

### "Something is broken"
1. Check: **[Development Guide > Troubleshooting](development-guide.md#troubleshooting)** - Common issues and fixes
2. Check: **[Current Status](current-status.md)** - See if there are known issues

### "I'm resuming after a break"
1. Read: **[Current Status](current-status.md)** - Get up to speed quickly
2. Check: **[Development Guide](development-guide.md)** - Refresh on project structure
3. Use: **[OpenCode Workflow > Session Recovery](opencode-workflow.md#session-recovery)** - How to start fresh

---

## Document Descriptions

### current-status.md
**Living document** that tracks:
- Implementation progress (what's done, what's in progress, what's next)
- Session notes from important development milestones
- Known issues and blockers
- Next steps

**Update frequency:** After major features or when resuming sessions

### development-guide.md
**Practical reference** covering:
- Project structure and key files
- Development workflow (TDD, code review, running the app)
- Testing patterns with examples
- Common tasks (adding handlers, aggregates, running tests)
- Troubleshooting common issues
- Windows-specific development notes

**Update frequency:** When adding new patterns or solving new problems

### opencode-workflow.md
**Process guide** for working with OpenCode:
- The code review cycle (review → commit workflow)
- When and how to use agents
- Communication patterns and trigger words
- Session recovery process
- Common workflows with examples

**Update frequency:** When workflows evolve or new patterns emerge

### architecture-decisions.md
**Decision log** documenting:
- Major architectural choices
- Context and rationale for each decision
- Trade-offs and consequences
- Implementation status
- SOLID principles applied

**Update frequency:** When making significant architectural decisions

### event-models.md
**Reference documentation** for:
- Event sourcing concepts
- Event schemas and examples
- Projection patterns
- Command/query separation

**Update frequency:** When adding new event types or patterns

### learning-log.md
**Personal notes** capturing:
- Lessons learned
- Mistakes and how they were fixed
- Insights and discoveries

**Update frequency:** Whenever you learn something worth remembering

---

## Documentation Maintenance

### Keeping Docs Fresh

**High Priority (Update Often):**
- `current-status.md` - After every major feature or session
- `learning-log.md` - Whenever you learn something new

**Medium Priority (Update When Relevant):**
- `development-guide.md` - When solving new problems or adding new patterns
- `architecture-decisions.md` - When making architectural decisions

**Low Priority (Rarely Changes):**
- `opencode-workflow.md` - Only if workflow significantly changes
- `event-models.md` - Only when adding fundamental new patterns
- `docs/README.md` (this file) - Only when adding/removing docs

### Documentation Quality

Good documentation should be:
- **Accurate** - Reflects current state of the project
- **Practical** - Helps you accomplish tasks
- **Searchable** - Easy to find what you need
- **Concise** - No unnecessary fluff

---

## Contributing to Documentation

When updating documentation:

1. **Check for outdated info** - Remove or update anything that's changed
2. **Add examples** - Show, don't just tell
3. **Use clear headings** - Make it scannable
4. **Link between docs** - Help readers navigate
5. **Update this index** - If you add/remove docs

---

## Quick Links

**External Resources:**
- [Event Sourcing Pattern (Martin Fowler)](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Bullet Journal Method](https://bulletjournal.com/pages/learn)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**Last Updated:** 2026-01-25  
**Maintained By:** OpenCode + User
