# Ralph Dashboard

Real-time dashboard for watching Ralph runs with live PRD progress, git state, code metrics, and coverage.

## Requirements

- Node.js 18+
- npm
- A target project that contains Ralph outputs (at minimum `.ralph/state.json`)

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production build

```bash
npm run build
npm run start
```

## Configure Which Project To Monitor

You can set the monitored project path in two ways:

1. Environment variable:

```bash
RALPH_PROJECT_PATH=/absolute/path/to/target-project npm run dev
```

2. URL query parameter:

```text
http://localhost:3000/?path=/absolute/path/to/target-project
```

Notes:
- `?path=` overrides `RALPH_PROJECT_PATH` when both are present.
- The dashboard persists the last successful project path in `localStorage`.
- The path must be an existing directory.

## Configuration Details

The dashboard reads data from these sources inside the monitored project:

- Ralph state: `.ralph/state.json`
- PRD: `prd_path` from Ralph state (if present), otherwise `prd.json`, otherwise first `prd*.json`
- Git: local repository state via `git` commands
- Coverage summary: `coverage/coverage-summary.json` or `.coverage/coverage-summary.json`

Live updates are polled every 2 seconds.

## Integration With Ralph CLI

1. Run Ralph in your target repository so it produces and updates `.ralph/state.json`.
2. Make sure the state file references your PRD (`prd_path`) or that the repo has a discoverable PRD JSON file.
3. Start Ralph Dashboard and point it at that repository using `RALPH_PROJECT_PATH` or `?path=`.
4. Keep Ralph running; the dashboard will reflect checkpoints, current item progress, and related git/metrics updates automatically.

## API Endpoints

- `GET /api/health` - health check
- `GET /api/state?path=/absolute/path` - combined Ralph, git, metrics, and coverage state

## Testing

```bash
npm test
```
