---
description: Implement feature following TDD
agent: sam
subtask: true
---

Act as Speedy Sam. Implement the following feature using TDD (Red-Green-Refactor):

$ARGUMENTS

Requirements:
1. Write tests FIRST
2. Run tests to verify they fail (RED)
3. Implement minimal code to pass (GREEN)
4. Refactor while keeping tests green
5. Ensure all tests pass
6. Report back with summary

Project structure:
- Domain: packages/shared/src/
- Tests: packages/shared/tests/
- UI: packages/client/src/components/

Follow event sourcing patterns: Commands → Events → Projections
