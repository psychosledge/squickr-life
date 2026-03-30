Use the casey subagent to review recent changes for code quality, test coverage, and best practices.

Check: handlers, projections, types, tests, UI components.

Provide:
- Quality rating (X/10)
- Strengths and weaknesses
- Refactoring suggestions
- Test coverage analysis
- Manual testing checklist

Recent changes:
!`git diff --stat HEAD~1`

Files changed:
!`git diff --name-only HEAD~1`
