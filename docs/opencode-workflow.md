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
     ├─→ Implementation/Bug fixes? → /implement (Sam)
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

We have **3 specialized agents**:

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
- Bug fixes
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

## The Development Loop

This is our **primary workflow** for all development. For multi-item sessions, we plan everything upfront, then execute one item at a time.

### Phase 1: Planning (Alex → User → Alex → ...)

```
┌─────────────────────────────────────────────────────────┐
│  User: Describes the work for the session               │
│  OpenCode: Creates todo list of all planned items       │
│  OpenCode: `/design [all items]`                        │
│  Alex: *Produces plan for each item, including:*        │
│    - Implementation approach                            │
│    - Any event model / ADR changes                      │
│    - Tutorial/UX changes if applicable                  │
│    - Clarifying questions for anything unclear          │
│      (Alex asks rather than assumes)                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  User: Critiques Alex's plan                            │
│    - Challenge any approach or assumption               │
│    - Request alternatives or deeper reasoning           │
│    - Answer Alex's clarifying questions                 │
│    - Suggest scope changes                              │
│                                                         │
│  IF changes requested:                                  │
│  OpenCode: `/design [revised scope / feedback]`         │
│  Alex: *Revises plan, re-asks any new questions*        │
│  (Repeat until user is satisfied)                       │
│                                                         │
│  IF plan looks good:                                    │
│  User: "Plan approved" (or equivalent)                  │
└─────────────────────────────────────────────────────────┘
```

> **Nothing moves to implementation until the user explicitly approves the plan.** OpenCode must wait for approval — it must not interpret silence or a vague "looks good" as approval.

### Phase 2: Execute Each Item (one at a time)

```
┌─────────────────────────────────────────────────────────┐
│  OpenCode: `/implement [item N per Alex's approved plan]`│
│  Sam: *Follows TDD, implements feature*                 │
│  Sam: "Feature complete, tests passing (X/X)"           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  OpenCode: `/review`                                    │
│  Casey: *Reviews code + tests*                         │
│  Casey: "Rating 8/10, here's feedback..."              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  IF Casey requests changes:                             │
│  OpenCode: `/implement [address Casey's feedback]`     │
│  Sam: *Fixes issues, re-runs tests*                    │
│  OpenCode: `/review` again                             │
│                                                         │
│  IF Casey approves:                                     │
│  OpenCode: *Runs FULL test suite (pnpm test --run)*   │
│  - Verifies ALL tests pass (not just new ones)        │
│  - Catches integration issues across packages          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  IF tests pass:                                         │
│  OpenCode: *Creates git commit for this item*          │
│  OpenCode: Moves to next planned item                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Repeat Phase 2 for each remaining item                 │
└─────────────────────────────────────────────────────────┘
```

### Phase 3: UAT (End of Session)

```
┌─────────────────────────────────────────────────────────┐
│  User: *Manual testing in browser (all items)*         │
│  - Test UI behavior                                     │
│  - Check console for errors                            │
│  - Verify data persistence                             │
│                                                         │
│  IF bugs found:                                         │
│  User: "There's a bug with X"                          │
│  OpenCode: `/implement [fix the bug]`                  │
│  Sam: *Investigates and fixes*                         │
│  OpenCode: `/review` → Casey → Commit                  │
└─────────────────────────────────────────────────────────┘
```

> **Exception:** User may request UAT earlier (e.g., after a specific item) by saying so explicitly. Otherwise, UAT happens at the end of the full planned session.

### Phase 4: Release (After UAT Passes)

When the user says "ship it":

1. Bump version in all `package.json` files (`package.json`, `packages/client`, `packages/domain`, `packages/infrastructure`)
2. Update `docs/roadmap.md` — add release entry, update current version and status
3. Update `docs/current-session.md` — mark status complete, mark all items ✅
4. Commit: `chore: bump version to vX.Y.Z and update docs`
5. Push commits: `git push`
6. Create and push tag: `git tag vX.Y.Z && git push origin vX.Y.Z`

> **The tag is what triggers deployment to production.** Pushing commits alone does NOT deploy. Step 6 is mandatory.

### Key Points:

1. **Alex plans first** - All items planned before any implementation begins
2. **Ask, don't assume** - Any agent with uncertainty asks the user rather than guessing
3. **User critiques the plan** - After Alex's plan, the user may challenge, redirect, or request alternatives before approving
4. **Explicit approval required** - Implementation only starts after the user says the plan is approved
5. **OpenCode orchestrates** - Never does implementation itself
6. **Always use slash commands** - `/design`, `/implement`, `/review`
7. **One item at a time** - Complete (implement → review → commit) before moving to next
8. **Casey reviews everything** - No commits without code review
9. **UAT at end of session** - Unless user explicitly requests earlier

---

## Slash Commands

### Quick Reference

| Command | Agent | Purpose |
|---------|-------|---------|
| `/design [what]` | Alex | Architecture decisions, event modeling |
| `/implement [what]` | Sam | Feature implementation, bug fixes (TDD) |
| `/review` | Casey | Code review + test coverage analysis |

### Usage Examples

```bash
# Design phase
/design event model for collections feature
/design Should we use microservices or monolith for sync?

# Implementation phase  
/implement Add drag-and-drop for daily log entries
/implement Create DeleteNoteHandler following TDD
/implement Fix double-submit bug in entry form

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
| "review" or `/review` | Calls `/review` command → Casey |
| "commit" | Creates git commit (after Casey approval) |
| "continue" | Proceeds to next task in todo list |

### OpenCode Signals

| OpenCode Says | Meaning |
|---------------|---------|
| "Calling `/implement`..." | Delegating to Sam for implementation |
| "Calling `/review`..." | Delegating to Casey for code review |
| "Calling `/design`..." | Delegating to Alex for architecture |
| "All tests passing (X/X)" | Tests successful |
| "Committed: [message]" | Git commit created |

### Agent Signals

| Agent Says | Meaning |
|------------|---------|
| "Feature complete, tests passing (X/X)" (Sam) | Implementation done |
| "Review complete. Rating: X/10" (Casey) | Code review finished |
| "ADR created: [title]" (Alex) | Architecture decision documented |

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
2. **docs/development-guide.md** - How to do common tasks  
3. **docs/architecture-decisions.md** - ADRs
4. **docs/event-models.md** - Event sourcing reference
5. **Git log** - `git log --oneline -10` to see recent work
6. **Todo list** - Use `todoread` tool to see task status

---

## Common Workflows

### Workflow 1: Adding a New Feature

```
User: Add ability to tag entries

OpenCode: I'll have Alex plan this first.
          [Calls `/design event model for entry tags`]

Alex: Here's the plan:
      - TagCreated, TagAddedToEntry, TagRemovedFromEntry events
      - TagProjection for querying tags
      - UI changes: tag picker on entry form
      - Tutorial step update: mention tagging
      Clarifying question: Should tags be global or per-collection?

User: Global tags, shared across all collections. Plan approved.

OpenCode: Plan approved. Starting implementation.
          [Calls `/implement tag system based on Alex's approved plan`]

Sam: Implementation complete:
     - Created tag.handlers.ts
     - Added TagProjection
     - Updated UI components
     - 25 tests added, all passing (330→355 total)

OpenCode: [Calls `/review`]

Casey: Review complete. Rating: 9/10
       Excellent work. Minor suggestions:
       - Consider extracting tag validation
       - Add test for empty tag name
       [Addresses feedback or approves]

OpenCode: Tests all passing (355/355). Committed: "feat: add global tag system"
          Moving to next planned item...

User: [At end of session] Testing in browser...
      The tag dropdown doesn't close after selection

OpenCode: [Calls `/implement fix tag dropdown not closing`]
...
```

---

### Workflow 2: Fixing a Bug

```
User: There's a bug - notes aren't saving

OpenCode: [Calls `/implement fix notes not saving`]

Sam: Investigated and fixed:
     
     Root cause: NoteHandler.ts:42
     The event store append() is called but not awaited.
     
     Fix: Added `await` before eventStore.append()
     Added regression test
     All tests passing

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

1. **Use slash commands** - `/design`, `/implement`, `/review`
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

### Command Files
Located in: `.opencode/commands/`
- `design.md` - `/design [what]` → Alex
- `implement.md` - `/implement [what]` → Sam
- `review.md` - `/review` → Casey

### Documentation Files
- **Development guide:** `docs/development-guide.md`
- **Architecture decisions:** `docs/architecture-decisions.md`
- **Event models:** `docs/event-models.md`
- **Workflow (this file):** `docs/opencode-workflow.md`
- **Todo list:** Use `todoread` tool

---

## The Golden Rule

**Alex plans. User critiques & approves. Sam implements. Casey reviews. User UATs. OpenCode commits and ships.**

Never skip the loop:
1. **Plan** (Alex — all items, upfront, with clarifying questions over assumptions)
2. **Critique & Approve** (User — challenge the plan, iterate with Alex until satisfied, then explicitly approve)
3. **Implement** (Sam — one item at a time, TDD)
4. **Review** (Casey — every item, no exceptions)
5. **Commit** (OpenCode — after Casey approval + full test suite passes)
6. **UAT** (User — at end of session, or explicitly earlier)
7. **Release** (OpenCode — bump version, update docs, push commits, push tag)

**Every. Single. Time.**

Any agent may ask clarifying questions at any point. Questions should be asked before work begins, not after. When in doubt, ask — never assume.

---

For development practices, see `development-guide.md`.  
For architecture decisions, see `architecture-decisions.md`.  
For event sourcing reference, see `event-models.md`.
