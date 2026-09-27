# ADR-001: Monorepo with pnpm Workspaces

**Date**: 2026-01-22  
**Status**: Accepted

## Context
Organize code for multi-package project (client, shared domain logic, future backend).

## Decision
Use monorepo with pnpm workspaces:
- `packages/client` - React PWA
- `packages/domain` - Pure business logic, event sourcing, types (Clean Architecture core)
- `packages/infrastructure` - EventStore implementations (IndexedDB, InMemory)
- `packages/backend` - Firebase Admin SDK functions (future)

## Rationale
- **Type Safety**: Shared types ensure client/backend use identical event schemas
- **Atomic Changes**: Event schema changes update all packages in single commit
- **pnpm Benefits**: Strict dependency management prevents phantom dependencies
- **Development Speed**: No need to publish/install shared package during dev

## Consequences
**Positive:**
- Type-safe contract between packages
- Single `pnpm install` for entire project
- Easier refactoring across packages

**Negative:**
- Slightly more complex setup
- All packages version together (acceptable for this project)

## SOLID Principles
- **Single Responsibility**: Each package has one clear purpose
- **Dependency Inversion**: Packages depend on abstractions in `shared`
