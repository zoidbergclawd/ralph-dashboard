# Ralph Dashboard

Real-time dashboard for watching Ralph runs with live PRD progress, git state, code metrics, and coverage.

![Ralph Dashboard](https://img.shields.io/badge/status-ready-green) ![Tests](https://img.shields.io/badge/tests-51%20passing-brightgreen)

---

## Quick Start Guide

Complete walkthrough to run Ralph CLI and watch builds in the Dashboard.

### Prerequisites

- **macOS/Linux** (Windows via WSL)
- **Python 3.11+** with [uv](https://github.com/astral-sh/uv) installed
- **Node.js 18+** with npm
- **Git** configured with GitHub access
- **AI Agent CLI** — one of:
  - [Codex CLI](https://github.com/openai/codex) (`npm install -g @openai/codex`)
  - [Claude Code](https://claude.com/code)
  - [Gemini CLI](https://github.com/google/gemini-cli)

### Step 1: Set Up Ralph CLI (Sisyphus)

```bash
# Clone and install
git clone https://github.com/zoidbergclawd/sisyphus.git
cd sisyphus
uv sync

# Verify
uv run ralph --version
# → ralph version 0.1.0

# Check available agents
uv run ralph agents
```

### Step 2: Set Up Ralph Dashboard

```bash
# Clone and install
git clone https://github.com/zoidbergclawd/ralph-dashboard.git
cd ralph-dashboard
npm install

# Start dashboard
npm run dev
# → http://localhost:3000
```

### Step 3: Run Your First Build

```bash
# Create a project with a PRD
mkdir ~/Projects/my-app && cd ~/Projects/my-app
git init

# Create prd.json (see example below)

# Start Ralph
uv run --project ~/Projects/sisyphus ralph start prd.json -a codex --push

# Watch in browser
# → http://localhost:3000?path=/Users/you/Projects/my-app
```

### Example PRD

```json
{
  "project": "My Demo App",
  "goal": "A simple CLI that says hello",
  "tech_stack": {
    "language": "Python",
    "testing": "pytest"
  },
  "items": [
    {
      "id": 1,
      "category": "setup",
      "title": "Test infrastructure",
      "description": "Set up pytest",
      "priority": 1,
      "passes": false,
      "verification": "pytest runs successfully",
      "steps": [
        "Create pyproject.toml",
        "Create tests/test_example.py with passing test"
      ]
    },
    {
      "id": 2,
      "category": "feature",
      "title": "Hello CLI",
      "description": "CLI that prints greeting",
      "priority": 1,
      "passes": false,
      "verification": "python -m hello prints 'Hello, World!'",
      "steps": [
        "Create src/hello/__main__.py",
        "Add test for CLI output"
      ]
    }
  ]
}
```

### Ralph CLI Commands

| Command | Description |
|---------|-------------|
| `ralph start prd.json -a codex` | Start new build with Codex |
| `ralph start prd.json -a claude` | Start with Claude Code |
| `ralph resume` | Resume interrupted run |
| `ralph status` | Check current progress |
| `ralph pr` | Create GitHub PR when done |
| `ralph agents` | List available AI agents |

**Options:**
- `-a, --agent` — Agent to use (codex, claude, gemini)
- `-m, --model` — Specific model (e.g., `gpt-5.3-codex`)
- `--push` — Auto-push commits to remote

---

## Dashboard Features

| Panel | Shows |
|-------|-------|
| **Kanban Board** | PRD items in columns (Backlog, In Progress, Done) |
| **Progress Panel** | X/Y complete, elapsed time, current item |
| **Git Panel** | Branch, commits, diff stats |
| **Metrics Panel** | LOC, files, tests, coverage % |
| **Activity Log** | Timestamped checkpoints and results |

Live polling every 2 seconds.

---

## Installation (Dashboard Only)

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production

```bash
npm run build
npm run start
```

## Configure Project Path

**Option 1: Environment variable**
```bash
RALPH_PROJECT_PATH=/path/to/project npm run dev
```

**Option 2: URL parameter**
```
http://localhost:3000/?path=/path/to/project
```

The dashboard persists the last successful path in localStorage.

## Data Sources

The dashboard reads from the monitored project:

| Source | Path |
|--------|------|
| Ralph state | `.ralph/state.json` |
| PRD | `prd_path` from state, or `prd.json`, or first `prd*.json` |
| Git | Local repo via `git` commands |
| Coverage | `coverage/coverage-summary.json` |

## API Endpoints

- `GET /api/health` — Health check
- `GET /api/state?path=/path` — Combined state (Ralph + git + metrics + coverage)

## Testing

```bash
npm test
```

51 tests across 12 test files.

---

## Troubleshooting

### "No test infrastructure detected"
Ralph requires tests. Add a test setup item as **item 1** in your PRD.

### Run gets interrupted
Just run `ralph resume` — checkpoints save after each item.

### Dashboard not updating
- Check project path is correct
- Ensure `.ralph/state.json` exists
- Check browser console for errors

---

## Links

- **Ralph CLI (Sisyphus)**: https://github.com/zoidbergclawd/sisyphus
- **Ralph Dashboard**: https://github.com/zoidbergclawd/ralph-dashboard
