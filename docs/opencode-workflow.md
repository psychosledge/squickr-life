# OpenCode Workflow Guide

Complete guide for working with OpenCode's orchestrator pattern and specialized agents.

## Table of Contents
- [Overview](#overview)
- [The Orchestrator Pattern](#the-orchestrator-pattern)
- [Agent Roles & Responsibilities](#agent-roles--responsibilities)
- [Delegation Decision Tree](#delegation-decision-tree)
- [The Code Review Cycle](#the-code-review-cycle)
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
5. **Clear Communication** - Explicit trigger words for different workflows

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
     ├─→ Research needed? → Delegate to Morgan or explore agent
     ├─→ Implementation needed? → Delegate to Speedy Sam
     ├─→ Review needed? → Delegate to Code-Review Casey
     └─→ Architecture decision? → Delegate to Architecture Alex
```

### OpenCode's Orchestrator Role

**Primary Responsibilities:**
- Read and understand user requests
- Break down complex tasks into subtasks
- Delegate to appropriate specialized agents
- Coordinate between agents
- Track progress and report back to user
- Handle trivial changes directly (to avoid overhead)

**What OpenCode Does NOT Do:**
- Implement large features directly
- Skip delegation for non-trivial work
- Review its own code (always uses Casey)
- Make architectural decisions alone (consults Alex)

---

## Agent Roles & Responsibilities

### 🎯 OpenCode (Orchestrator)

**When to use:** Always - this is the primary interface

**Capabilities:**
- Task breakdown and planning
- Agent coordination
- Progress tracking
- Trivial code changes (typos, 1-2 line fixes)

**Example invocations:**
```
User: Add drag-and-drop for notes
OpenCode: I'll break this down and delegate to Speedy Sam for implementation...
```

---

### 🎨 Model-First Morgan

**Role:** Event modeling & user experience design

**When to use:**
- Designing new event schemas
- Creating user stories
- Modeling domain aggregates
- Planning user workflows

**Capabilities:**
- Event storming
- Domain modeling
- User journey mapping
- Event schema design

**Example delegation:**
```typescript
Task(
  subagent_type="general",
  description="Design event model for notes",
  prompt="Act as Model-First Morgan. Design the event model for a 'Note' aggregate.
  Include: event types, commands, data fields, relationships with other aggregates.
  Follow event sourcing best practices."
)
```

---

### ⚙️ Architecture Alex

**Role:** System design & SOLID principles

**When to use:**
- Making architectural decisions
- Evaluating design patterns
- Ensuring SOLID compliance
- Creating ADRs (Architecture Decision Records)

**Capabilities:**
- System architecture design
- Pattern selection
- SOLID principle evaluation
- ADR documentation

**Example delegation:**
```typescript
Task(
  subagent_type="general",
  description="Design entry type architecture",
  prompt="Act as Architecture Alex. We need to support three entry types: Task, Note, Event.
  Decide: Should we use separate events (TaskCreated, NoteCreated) or generic events (EntryCreated)?
  Document as ADR with: context, decision, rationale, consequences, SOLID principles."
)
```

---

### ✅ Test-First Terry

**Role:** TDD enforcement & test quality

**When to use:**
- Reviewing test coverage
- Ensuring TDD is followed
- Validating test quality
- Suggesting test improvements

**Capabilities:**
- Test coverage analysis
- TDD process validation
- Test pattern recommendations
- Edge case identification

**Example delegation:**
```typescript
Task(
  subagent_type="general",
  description="Review test coverage",
  prompt="Act as Test-First Terry. Review the test coverage for the Note handlers.
  Check: Are all edge cases covered? Do tests follow AAA pattern? Is TDD being followed?
  Suggest improvements."
)
```

---

### 🔍 Code-Review Casey

**Role:** Quality assurance & refactoring

**When to use:**
- **ALWAYS** - before any commit
- After feature implementation
- When refactoring is needed
- For code smell detection

**Capabilities:**
- Code quality analysis
- Refactoring suggestions
- Pattern recognition
- Best practice enforcement

**Example delegation:**
```typescript
Task(
  subagent_type="general",
  description="Review entry types implementation",
  prompt="Act as Code-Review Casey. Review all code related to entry types implementation.
  Check: handlers, projection, types, tests.
  Provide: quality rating (X/10), strengths, weaknesses, refactoring suggestions.
  Be thorough and critical."
)
```

---

### 🚀 Speedy Sam

**Role:** Implementation & bug fixes

**When to use:**
- Implementing new features
- Fixing bugs
- Writing production code
- Following TDD cycle

**Capabilities:**
- Feature implementation
- Bug fixes
- Test writing
- Code execution

**Example delegation:**
```typescript
Task(
  subagent_type="general",
  description="Implement ReorderNoteHandler",
  prompt="Act as Speedy Sam. Implement the ReorderNoteHandler following TDD.
  
  Requirements:
  1. Write tests FIRST in packages/shared/tests/note.handlers.test.ts
  2. Implement handler in packages/shared/src/note.handlers.ts
  3. Follow existing patterns from ReorderTaskHandler
  4. Run tests and ensure all pass
  5. Export from index.ts
  
  Report back: test results, implementation summary, any issues encountered."
)
```

---

## Delegation Decision Tree

### When OpenCode Should Delegate

```
User Request Received
     ↓
Is it a trivial change (typo, 1-2 lines)?
     ├─ YES → OpenCode handles directly
     └─ NO → Continue evaluation
          ↓
Is it a design/modeling task?
     ├─ YES → Delegate to Morgan
     └─ NO → Continue
          ↓
Is it an architectural decision?
     ├─ YES → Delegate to Alex
     └─ NO → Continue
          ↓
Is it test review/improvement?
     ├─ YES → Delegate to Terry
     └─ NO → Continue
          ↓
Is it code review?
     ├─ YES → Delegate to Casey
     └─ NO → Continue
          ↓
Is it implementation (feature/bugfix)?
     ├─ YES → Delegate to Sam
     └─ NO → Delegate to general agent
```

### Examples by Category

**Trivial (OpenCode handles):**
- Fix typo in comment
- Update version number
- Add single line export
- Rename variable (1-2 occurrences)

**Design (Morgan):**
- "Design event model for collections"
- "Create user stories for daily log"
- "Model the migration workflow"

**Architecture (Alex):**
- "Should we use microservices or monolith?"
- "Decide on state management approach"
- "Create ADR for sync strategy"

**Testing (Terry):**
- "Review test coverage for handlers"
- "Check if TDD was followed"
- "Suggest edge cases for projection tests"

**Code Review (Casey):**
- "Review the entry types implementation"
- "Check for code smells in handlers"
- "Suggest refactorings for duplication"

**Implementation (Sam):**
- "Implement ReorderNoteHandler"
- "Fix bug in EntryListProjection"
- "Add filtering UI for entry types"

---

## The Code Review Cycle

This is the PRIMARY workflow for all feature development.

### Step-by-Step Process

```
┌─────────────────────────────────────────────────────────┐
│  1. User: "Add feature X"                              │
│     OpenCode: *Evaluates and delegates to Sam*         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. Sam: *Implements feature following TDD*            │
│     Sam: "Feature complete, tests passing"             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. OpenCode: "Ready for code review"                  │
│     (OpenCode waits for user confirmation)             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. User: "review"                                      │
│     OpenCode: *Delegates to Casey*                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  5. Casey: *Reviews code, provides rating + feedback*  │
│     Casey: "Please do manual review and UI testing"    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  6. User: *Manual review + testing*                    │
│     - Read code changes                                │
│     - Run tests manually                               │
│     - Test UI in browser                               │
│     - Verify behavior                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  7a. IF changes needed:                                │
│      User: "Fix X, Y, Z"                               │
│      → OpenCode delegates to Sam → Go back to step 2  │
│                                                         │
│  7b. IF everything looks good:                         │
│      User: "commit"                                    │
│      → Proceed to step 8                               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  8. OpenCode: *Creates git commit*                     │
│     "Committed: [commit message]"                      │
│     "Ready for next task"                              │
└─────────────────────────────────────────────────────────┘
```

---

## Communication Patterns

### User Trigger Words

| User Says | OpenCode Does |
|-----------|---------------|
| "review" | Delegates to Casey for code review |
| "commit" | Creates git commit with changes |
| "continue" | Proceeds to next task in todo list |
| "design X" | Delegates to Morgan for event modeling |
| "decide X" | Delegates to Alex for architecture decision |

### OpenCode Signals

| OpenCode Says | Meaning |
|---------------|---------|
| "Delegating to Speedy Sam..." | Implementation work starting |
| "Launching Casey for review..." | Code review starting |
| "Ready for code review" | Feature complete, waiting for user to say "review" |
| "All tests passing (X/X)" | Tests successful |
| "Committed: [message]" | Git commit created |

### Agent Signals

| Agent Says | Meaning |
|------------|---------|
| "Feature complete, tests passing" (Sam) | Implementation done |
| "Review complete. Rating: X/10" (Casey) | Code review finished |
| "ADR created: [title]" (Alex) | Architecture decision documented |
| "Event model designed: [summary]" (Morgan) | Domain model ready |

---

## Session Recovery

### Starting a New Session

When resuming work after a break:

```
User: Read the README and current-status.md

OpenCode: [Reads files, summarizes current state]
I can see we're working on [current phase].
Completed: [list]
In progress: [current task]
Next up: [upcoming tasks]

Would you like me to delegate to [appropriate agent] to continue?
```

### Context Files to Check

1. **README.md** - Project overview, agent roles
2. **docs/current-status.md** - Implementation status, session notes
3. **docs/development-guide.md** - How to do common tasks
4. **Todo list** - Use `todoread` tool to see task status

---

## Common Workflows

### Workflow: Adding a New Feature

```
User: Add drag-and-drop for notes

OpenCode: I'll delegate this to Speedy Sam for implementation.
[Launches Sam with detailed instructions]

Sam: Feature implemented. Tests passing (15/15 new tests).
- Created ReorderNoteHandler
- Updated EntryListProjection
- Wired up in App.tsx

OpenCode: Ready for code review.

User: review

OpenCode: Launching Casey for review...

Casey: Review complete. Rating: 9.2/10
[Provides detailed feedback]

User: [Tests manually]

User: commit

OpenCode: ✓ Committed: "Add drag-and-drop for notes"
```

### Workflow: Bug Fix

```
User: Notes aren't saving to localStorage

OpenCode: Let me investigate...
[Reads code, identifies issue]

Found the issue in event-store.ts:42
The save() method isn't being called after append.

I'll delegate to Speedy Sam to fix this.

Sam: Bug fixed. Added test to prevent regression.
Tests passing (189/189).

OpenCode: Ready for code review.

User: review
[... review cycle ...]
User: commit
```

### Workflow: Architecture Decision

```
User: Should we use separate events per type or generic events?

OpenCode: This is an architectural decision. Delegating to Architecture Alex...

Alex: Created ADR-004: Separate Events per Aggregate Type
Decision: Use TaskCreated, NoteCreated, EventCreated (not generic EntryCreated)
Rationale: [detailed explanation]

OpenCode: ADR documented. Proceeding with separate events approach.
```

---

## Best Practices

### For Users

1. **Be explicit** - Say "review" and "commit", not vague confirmations
2. **Do manual testing** - Always test UI before committing  
3. **Trust the process** - Let OpenCode delegate appropriately
4. **One feature at a time** - Complete review cycle before moving on

### For OpenCode (Orchestrator)

1. **Always delegate non-trivial work** - Don't implement features yourself
2. **Always use Casey for reviews** - Never skip code review
3. **Wait for "commit"** - Never commit without user confirmation
4. **Track agent work** - Monitor what each agent is doing
5. **Report clearly** - Tell user which agent is working and why

### Task Management Rules

1. **ONE task in_progress at a time**
2. **Mark completed IMMEDIATELY** after finishing
3. **Break down complex tasks** into smaller, delegatable pieces
4. **Cancel tasks** that become irrelevant

---

## Quick Reference

### User Commands
- **"review"** → Trigger code review (OpenCode delegates to Casey)
- **"commit"** → Create git commit (OpenCode handles)
- **"continue"** → Proceed to next task
- **"design [X]"** → Request design work (OpenCode delegates to Morgan)
- **"decide [X]"** → Request architecture decision (OpenCode delegates to Alex)

### Agent Capabilities

| Agent | Primary Use | Tool Type |
|-------|-------------|-----------|
| Morgan | Event modeling, UX design | `general` |
| Alex | Architecture decisions, ADRs | `general` |
| Terry | Test review, TDD enforcement | `general` |
| Casey | Code review, refactoring | `general` |
| Sam | Implementation, bug fixes | `general` |

### File Locations
- **Current status:** `docs/current-status.md`
- **How to guides:** `docs/development-guide.md`
- **Architecture:** `docs/architecture-decisions.md`
- **Todo list:** Use `todoread` tool

---

For development practices, see `development-guide.md`.  
For implementation status, see `current-status.md`.  
For architecture decisions, see `architecture-decisions.md`.
