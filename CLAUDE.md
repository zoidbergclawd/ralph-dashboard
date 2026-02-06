# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ralph Dashboard is a real-time Next.js 14 web UI for monitoring autonomous AI coding runs. It polls a monitored project's filesystem every 2 seconds to display PRD progress, git state, code metrics, and test coverage.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint (next/core-web-vitals + next/typescript)
npm test         # Run all tests (vitest run)
npx vitest run __tests__/example.test.ts   # Run a single test file
```

## Architecture

### Data Flow

The dashboard is a polling-based read-only viewer. There is no database or persistent backend state.

```
Browser → LiveDashboard → useDashboardState (React Query, 2s poll)
  → GET /api/state?path=/project/path
    → Promise.all([getRalphUnifiedView, readGitState, readCodeMetrics, readCoverageState])
      → reads .ralph/state.json, prd*.json, git commands, coverage-summary.json
  → JSON response → components render panels
```

### Key Directories

- `app/` — Next.js App Router: root layout, home page, API routes (`/api/state`, `/api/health`)
- `components/` — React components: LiveDashboard (main wrapper), KanbanBoard, ProgressPanel, GitPanel, MetricsPanel, ActivityLog
- `hooks/` — `useDashboardState` custom hook wrapping React Query with polling
- `lib/` — Server-side filesystem readers: `ralph-state.ts`, `git-state.ts`, `code-metrics.ts`, `coverage-state.ts`, `utils.ts`
- `__tests__/` — Vitest + React Testing Library tests (jsdom environment)

### State Readers (lib/)

Each reader returns a result object with data and error fields, handling missing/malformed files gracefully. They run concurrently in the `/api/state` handler via `Promise.all`.

- **ralph-state.ts** — Reads `.ralph/state.json` and PRD files; normalizes and merges into `RalphUnifiedView` with defensive JSON parsing
- **git-state.ts** — Executes git commands via `execFile` (not `exec`) to get branch, commits, diff stats
- **code-metrics.ts** — Recursive directory walk counting LOC per language (excludes `.git`, `node_modules`, `.next`, `.ralph`)
- **coverage-state.ts** — Reads `coverage/coverage-summary.json` or `.coverage/coverage-summary.json`

### Project Path Resolution

The monitored project path is resolved in order: `?path=` query param → `RALPH_PROJECT_PATH` env var → localStorage (last successful path).

## Tech Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript** (strict mode)
- **Tailwind CSS 3.4** with CSS variable theming (dark mode default) + **shadcn/ui** (new-york style)
- **React Query v5** for data fetching/polling with `keepPreviousData`
- **Framer Motion 11** for Kanban card and layout animations
- **Vitest 4** + **React Testing Library 16** + **jsdom** for tests
- Path alias: `@/*` maps to project root

## Testing Patterns

- Component tests mock `fetch` for API calls
- File I/O tests use temporary directories
- Async tests use fake timers and deferred promises for control flow
- Setup file (`vitest.setup.ts`) imports `@testing-library/jest-dom`

## Conventions

- All external data (JSON files, git output) goes through normalization functions with explicit field validation — never trust raw parsed JSON directly
- `cn()` helper (clsx + tailwind-merge) for conditional class names
- No Redux or global state management — React Query handles server state, `useState` handles UI state
