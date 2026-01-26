# OpenCode Workflow Guide

Complete guide for working with OpenCode's orchestrator pattern and specialized agents.

## Table of Contents
- [Overview](#overview)
- [The Orchestrator Pattern](#the-orchestrator-pattern)
- [Agent Team](#agent-team)
- [The Development Loop](#the-development-loop)
- [Slash Commands](#slash-commands)
- [Communication Patterns](#communication-patterns)
- [Session Recovery](#session-recovery)
- [Common Workflows](#common-workflows)

---

## Overview

This project uses an **orchestrator pattern** where OpenCode coordinates specialized agents rather than doing all the work itself. This prevents "takeover" and ensures proper separation of concerns.

### Core Philosophy

1. **Orchestration over Implementation** - OpenCode delegates, doesn't dominate
2. **Specialized Agents** - Each agent has a clear role and expertise  
3. **Test-Driven Development** - Write tests first, then implement
4. **Code Review Everything** - Every feature gets reviewed before committing
5. **Clear Communication** - Slash commands and explicit trigger words

---

## The Orchestrator Pattern

### How It Works

```
User Request
     ↓
OpenCode (Orchestrator)
     ↓
Evaluates task complexity
     ↓
     ├─→ Trivial (1-2 lines)? → OpenCode handles directly
     ├─→ Architecture/Design? → /design (Alex)
     ├─→ Implementation? → /implement (Sam)
     ├─→ Bug investigation? → /debug (Diane)
     └─→ Code review? → /review (Casey)
```

### OpenCode's Orchestrator Role

**Primary Responsibilities:**
- Understand user requests and break down complex tasks
- Delegate to appropriate specialized agents via slash commands
- Coordinate between agents (e.g., Alex → Sam → Casey)
- Track progress with TodoWrite tool
- Report back to user with summaries
- Handle trivial changes directly (typos, 1-2 line fixes)

**What OpenCode Does NOT Do:**
- Implement large features directly (delegates to Sam)
- Skip delegation for non-trivial work
- Review its own code (always uses Casey via `/review`)
- Make architectural decisions alone (consults Alex via `/design`)

---

## Agent Team

We have **4 specialized agents** (consolidated from 5):

### ⚙️ Architecture Alex
**Slash command:** `/design [what to design]`

**Role:** Architecture decisions + Event modeling (consolidated Morgan + Alex)

**When to use:**
- Designing event schemas for new aggregates
- Making architectural decisions (patterns, structure)
- Creating ADRs (Architecture Decision Records)
- Evaluating design patterns and SOLID principles
- Planning system components and data flow

**Capabilities:**
- Event modeling and event storming
- System architecture design
- SOLID principle evaluation
- ADR documentation
- Domain-driven design

**Example:**
```
/design event model for recurring tasks
/design Should we use optimistic updates or wait for event confirmation?
```

**Agent file:** `.opencode/agents/alex.md`

---

### 🔍 Code-Review Casey
**Slash command:** `/review`

**Role:** Code quality review + Test coverage analysis (consolidated Terry + Casey)

**When to use:**
- **ALWAYS** - before any commit
- After feature implementation
- When refactoring is needed
- For code smell detection
- To verify test coverage

**Capabilities:**
- Code quality analysis (SOLID, DRY, readability)
- Test coverage and quality review (TDD compliance, edge cases)
- Refactoring suggestions
- Pattern recognition
- Best practice enforcement

**Output:**
- Quality rating (X/10)
- Strengths and weaknesses
- Refactoring suggestions with priority
- Test coverage analysis
- Manual testing checklist
- Approval status (ready to commit or needs changes)

**Example:**
```
/review
```

**Agent file:** `.opencode/agents/casey.md`

---

### 🚀 Speedy Sam
**Slash command:** `/implement [feature description]`

**Role:** Implementation & bug fixes following TDD

**When to use:**
- Implementing new features
- Fixing bugs
- Writing handlers, projections, components
- Following TDD Red-Green-Refactor cycle

**Workflow:**
1. **RED**: Write failing tests first
2. **GREEN**: Implement minimal code to pass
3. **REFACTOR**: Clean up while keeping tests green

**Capabilities:**
- Feature implementation
- Bug fixes (after Diane identifies root cause)
- Test writing (unit, integration)
- Code execution and verification
- Following existing patterns

**Example:**
```
/implement Add ability to archive completed tasks
/implement Fix the reorder bug in note list
```

**Agent file:** `.opencode/agents/sam.md`

---

### 🐛 Debug Diane
**Slash command:** `/debug [issue description]`

**Role:** Bug investigation & root cause analysis (NEW)

**When to use:**
- User reports unexpected behavior
- Tests are failing mysteriously
- Need to isolate root cause of bug
- Understanding why something doesn't work

**Process:**
1. Gather information (symptoms, reproduction steps)
2. Reproduce the issue
3. Add diagnostic logging
4. Isolate the problem (binary search approach)
5. Analyze data flow (trace execution)
6. Test hypothesis
7. Document findings with evidence
8. Recommend fix (hands off to Sam for implementation)

**Capabilities:**
- Console logging strategy
- Git bisect for regressions
- Browser DevTools investigation
- Common bug pattern recognition
- Evidence-based diagnosis

**Example:**
```
/debug Tasks are being created twice when I press Enter
/debug Daily logs showing wrong date for entries
```

**Agent file:** `.opencode/agents/diane.md`

---

## The Development Loop

This is our **primary workflow** for all development:

```
┌─────────────────────────────────────────────────────────┐
│  User: "Add feature X"                                  │
│  OpenCode: *Creates todo list, evaluates complexity*   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  If complex design needed:                              │
│  OpenCode: `/design [feature X architecture]`          │
│  Alex: *Provides event model, ADR, or architecture*    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  OpenCode: `/implement [feature X]`                     │
│  Sam: *Follows TDD, implements feature*                │
│  Sam: "Feature complete, tests passing (X/X)"          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  OpenCode: `/review`                                    │
│  Casey: *Reviews code + tests*                         │
│  Casey: "Rating 8/10, here's feedback..."              │
│  Casey: "Please do manual review and UI testing"       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  User: *Manual testing in browser*                     │
│  - Test UI behavior                                     │
│  - Check console for errors                            │
│  - Verify data persistence                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  IF issues found:                                       │
│  User: "There's a bug with X"                          │
│  OpenCode: `/debug [issue description]`                │
│  Diane: *Investigates, finds root cause*               │
│  OpenCode: `/implement [fix based on Diane findings]`  │
│  → Back to review step                                 │
│                                                         │
│  IF everything looks good:                             │
│  User: "commit"                                         │
│  OpenCode: *Creates git commit*                        │
└─────────────────────────────────────────────────────────┘
```

### Key Points:

1. **OpenCode orchestrates** - Never does implementation itself
2. **Always use slash commands** - `/design`, `/implement`, `/debug`, `/review`
3. **One agent at a time** - Clear handoffs between agents
4. **Casey reviews everything** - No commits without code review
5. **User tests manually** - Agents can't test UI in browser
6. **User approves commits** - Say "commit" explicitly

---

## Slash Commands

### Quick Reference

| Command | Agent | Purpose |
|---------|-------|---------|
| `/design [what]` | Alex | Architecture decisions, event modeling |
| `/implement [what]` | Sam | Feature implementation, bug fixes (TDD) |
| `/debug [issue]` | Diane | Bug investigation, root cause analysis |
| `/review` | Casey | Code review + test coverage analysis |

### Usage Examples

```bash
# Design phase
/design event model for collections feature
/design Should we use microservices or monolith for sync?

# Implementation phase  
/implement Add drag-and-drop for daily log entries
/implement Create DeleteNoteHandler following TDD

# Debugging phase
/debug Entry form is submitting twice
/debug Projection not updating after reorder

# Review phase (always before commit)
/review
```

### Command Files Location

- **Project-specific:** `C:/Repos/squickr/life/.opencode/commands/`
- **Global:** `~/.config/opencode/commands/`

---

## Communication Patterns

### User Trigger Words

| User Says | OpenCode Does |
|-----------|---------------|
| "design X" or `/design X` | Calls `/design` command → Alex |
| "implement X" or `/implement X` | Calls `/implement` command → Sam |
| "debug X" or `/debug X` | Calls `/debug` command → Diane |
| "review" or `/review` | Calls `/review` command → Casey |
| "commit" | Creates git commit (after Casey approval) |
| "continue" | Proceeds to next task in todo list |

### OpenCode Signals

| OpenCode Says | Meaning |
|---------------|---------|
| "Calling `/implement`..." | Delegating to Sam for implementation |
| "Calling `/review`..." | Delegating to Casey for code review |
| "Calling `/design`..." | Delegating to Alex for architecture |
| "Calling `/debug`..." | Delegating to Diane for investigation |
| "All tests passing (X/X)" | Tests successful |
| "Committed: [message]" | Git commit created |

### Agent Signals

| Agent Says | Meaning |
|------------|---------|
| "Feature complete, tests passing (X/X)" (Sam) | Implementation done |
| "Review complete. Rating: X/10" (Casey) | Code review finished |
| "ADR created: [title]" (Alex) | Architecture decision documented |
| "Root cause: [description]" (Diane) | Bug diagnosis complete |

---

## Session Recovery

### Starting a New Session

When resuming work after a break:

```
User: What did we do so far?

OpenCode: [Reads context, summarizes]
We completed the Daily Logs feature with reactive projections.
Last commit: [commit hash] - "Implement Daily Logs..."

Ready to continue? Current todo list has X items pending.

Would you like me to continue with [next task]?
```

### Context Files to Check

OpenCode should read these files to get context:

1. **docs/opencode-workflow.md** - Agent workflow (this file)
2. **docs/current-status.md** - Implementation status
3. **docs/development-guide.md** - How to do common tasks  
4. **docs/architecture-decisions.md** - ADRs
5. **Git log** - `git log --oneline -10` to see recent work
6. **Todo list** - Use `todoread` tool to see task status

---

## Common Workflows

### Workflow 1: Adding a New Feature

```
User: Add ability to tag entries

OpenCode: I'll delegate this to our team.

1. First, let's design the event model
   [Calls `/design event model for entry tags`]

Alex: Here's the event model for tags:
      - TagCreated, TagAddedToEntry, TagRemovedFromEntry
      - TagProjection for querying tags
      [Provides full ADR]

OpenCode: Great! Now let's implement it.
          [Calls `/implement tag system based on Alex's design`]

Sam: Implementation complete:
     - Created tag.handlers.ts
     - Added TagProjection
     - Updated UI components
     - 25 tests added, all passing (330→355 total)

OpenCode: Ready for review.
          [Calls `/review`]

Casey: Review complete. Rating: 9/10
       Excellent work. Minor suggestions:
       - Consider extracting tag validation
       - Add test for empty tag name
       Please do manual UI testing.

User: [Tests in browser - finds bug]
      The tag dropdown doesn't close after selection

OpenCode: Let me investigate that.
          [Calls `/debug tag dropdown doesn't close`]

Diane: Root cause found:
       TagDropdown.tsx:45 - missing onClick handler for backdrop
       Recommend adding backdrop click handler

OpenCode: [Calls `/implement fix tag dropdown based on Diane's findings`]

Sam: Bug fixed. Added test to prevent regression.
     All tests passing (356/356).

OpenCode: [Calls `/review`]

Casey: Rating: 9.5/10. Fix looks good. Ready to commit.

User: commit

OpenCode: ✓ Committed: "Add tag system for entries"
```

---

### Workflow 2: Fixing a Bug

```
User: There's a bug - notes aren't saving

OpenCode: Let me investigate.
          [Calls `/debug notes aren't saving`]

Diane: Investigation complete:
       
       Root cause: NoteHandler.ts:42
       The event store append() is called but not awaited.
       
       Evidence:
       - Console shows event created
       - IndexedDB shows no events
       - Missing `await` keyword
       
       Fix: Add `await` before eventStore.append()

OpenCode: [Calls `/implement fix based on Diane's diagnosis`]

Sam: Bug fixed:
     - Added `await` in NoteHandler
     - Added regression test
     - All tests passing

OpenCode: [Calls `/review`]

Casey: Rating: 9/10. Good fix with regression test.
       Ready to commit.

User: commit

OpenCode: ✓ Committed: "Fix async bug in NoteHandler"
```

---

### Workflow 3: Architecture Decision

```
User: Should we support offline mode?

OpenCode: This is an architectural decision.
          [Calls `/design evaluate offline mode architecture`]

Alex: Created ADR-005: Offline-First with Service Workers

      Decision: Implement offline-first architecture
      
      Rationale:
      - Event sourcing makes offline easy (append-only log)
      - Service worker caches UI and events
      - Sync when online (conflict resolution via timestamps)
      
      Consequences:
      - (+) Works offline completely
      - (+) Fast, no network latency
      - (-) Need sync conflict resolution
      - (-) Increased complexity
      
      SOLID Analysis: Aligns with Open/Closed principle
      
      Recommendation: Proceed with implementation

OpenCode: Alex recommends offline-first. Do you want to proceed?

User: Yes, let's implement it

OpenCode: [Breaks down into subtasks, delegates to Sam]
```

---

## Best Practices

### For Users

1. **Use slash commands** - `/design`, `/implement`, `/debug`, `/review`
2. **Be explicit** - Say "commit" clearly, not vague confirmations
3. **Do manual testing** - Always test UI before committing
4. **Trust the loop** - Let agents do their specialized work
5. **One feature at a time** - Complete the loop before moving on

### For OpenCode (Orchestrator)

1. **Always delegate non-trivial work** - Use slash commands
2. **Always `/review` before commit** - Never skip Casey
3. **Wait for "commit"** - Never commit without user approval
4. **Use TodoWrite** - Track all tasks and progress
5. **Report clearly** - Summarize what each agent did
6. **Call agents explicitly** - Use slash commands, not Task tool directly

### Task Management Rules

1. **ONE task in_progress at a time**
2. **Mark completed IMMEDIATELY** after finishing
3. **Break down complex tasks** into delegatable pieces
4. **Cancel tasks** that become irrelevant

---

## Quick Reference

### Agent Files
Located in: `.opencode/agents/`
- `alex.md` - Architecture + Event Modeling
- `casey.md` - Code Review + Test Coverage
- `sam.md` - Implementation (TDD)
- `diane.md` - Debugging + Investigation

### Command Files
Located in: `.opencode/commands/`
- `design.md` - `/design [what]` → Alex
- `review.md` - `/review` → Casey
- `implement.md` - `/implement [what]` → Sam
- `debug.md` - `/debug [issue]` → Diane

### Documentation Files
- **Current status:** `docs/current-status.md`
- **Development guide:** `docs/development-guide.md`
- **Architecture decisions:** `docs/architecture-decisions.md`
- **Workflow (this file):** `docs/opencode-workflow.md`
- **Todo list:** Use `todoread` tool

---

## The Golden Rule

**OpenCode orchestrates. Agents execute. User approves.**

Never skip the loop:
1. Design (Alex if needed)
2. Implement (Sam)
3. Review (Casey)  
4. User manual test
5. Commit (user approval)

**Every. Single. Time.**

---

For development practices, see `development-guide.md`.  
For implementation status, see `current-status.md`.  
For architecture decisions, see `architecture-decisions.md`.
