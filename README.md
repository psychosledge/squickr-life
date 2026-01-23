# Squickr Life

> **Get shit done quicker with Squickr!**

A personal task tracker built with event sourcing, offline-first PWA architecture, and strict TDD principles.

## 🚀 Vision

Squickr Life is a replacement for traditional bullet journaling, designed to work seamlessly across your Android phone, iPad, and computer - all while being completely offline-capable with Google account backup.

## 🏗️ Architecture

- **Event Sourcing + CQRS**: Every action is an event, state is derived from event history
- **Offline-First**: Works without internet, syncs when available
- **Test-Driven**: Strict TDD approach with comprehensive test coverage
- **SOLID Principles**: Clean, maintainable, extensible architecture

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript** - Type-safe UI components
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Beautiful, accessible components
- **IndexedDB** - Local event store persistence
- **PWA** - Installable, offline-capable

### Backend (Phase 2)
- **Supabase** - PostgreSQL event store, auth, real-time sync
- **Google OAuth** - Seamless authentication

### Testing
- **Vitest** - Fast unit and integration tests
- **Testing Library** - Component testing
- **Playwright** - End-to-end testing (future)

## 📁 Project Structure

```
squickr-life/
├── packages/
│   ├── client/          # React PWA application
│   ├── shared/          # Shared event types and interfaces
│   └── backend/         # Supabase functions (future)
├── docs/
│   ├── event-models.md           # Event modeling diagrams
│   ├── architecture-decisions.md # ADRs and design choices
│   └── learning-log.md           # Development learning notes
├── package.json         # Monorepo workspace config
└── pnpm-workspace.yaml  # pnpm workspace definition
```

## 🎯 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **pnpm** >= 8.0.0

### Install pnpm

```bash
npm install -g pnpm
```

### Installation

```bash
# Install all dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## 🤖 AI Agent Team

This project is being built with an agentic coding approach, featuring:

- **🎨 Model-First Morgan** - Event modeling & user experience design
- **⚙️ Architecture Alex** - System design & SOLID principles
- **✅ Test-First Terry** - TDD enforcement & test quality
- **🔍 Code-Review Casey** - Quality assurance & refactoring
- **🚀 Speedy Sam** - Lead developer & orchestration

## 🗺️ Roadmap

### Phase 1: Local-Only MVP ✨ *In Progress*
- [x] Project setup and monorepo structure
- [ ] Event store implementation
- [ ] Task creation and completion
- [ ] Offline-first PWA

### Phase 2: Feature Expansion
- [ ] Task editing and deletion
- [ ] Daily logs and rapid logging
- [ ] Task migrations
- [ ] Collections

### Phase 3: Backend & Sync
- [ ] Supabase integration
- [ ] Google OAuth
- [ ] Real-time event synchronization
- [ ] Conflict resolution

## 📚 Learning Goals

This project serves as a comprehensive learning journey:

- Event Sourcing patterns and best practices
- CQRS architecture
- Test-Driven Development discipline
- Progressive Web Apps
- Offline-first application design
- Agentic coding workflows
- Docker containerization (future)

## 📝 License

MIT

## 🎨 Tagline Ideas

- "Get shit done quicker with Squickr!"
- "Shop quicker with Squickr" *(original for Squickr Shop)*
- "Track life quicker with Squickr Life"

---

**Built with ❤️ and event sourcing**
