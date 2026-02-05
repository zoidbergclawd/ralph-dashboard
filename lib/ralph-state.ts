import { promises as fs } from "node:fs";
import path from "node:path";

export interface Checkpoint {
  item_id: number;
  commit_sha: string;
  timestamp: string;
  files_changed: string[];
  tests_passed: boolean;
  route: string;
}

export interface RalphState {
  branch: string | null;
  prd_path: string | null;
  current_item: number | null;
  completed_items: number[];
  started_at: string | null;
  checkpoints: Checkpoint[];
  agent: string | null;
  model: string | null;
  auto_push: boolean | null;
  pr_url: string | null;
  base_branch: string | null;
  current_action: string | null;
  action_started_at: string | null;
  watchdog_timeout: number | null;
  last_output_at: string | null;
  watchdog_triggered: boolean | null;
}

export interface PRDItem {
  id: number;
  category: string;
  title: string;
  description: string;
  priority: number;
  passes: boolean;
  verification: string;
  steps: string[];
  notes: string;
}

export interface PRDDocument {
  project: string | null;
  goal: string | null;
  items: PRDItem[];
}

export interface UnifiedPRDItem extends PRDItem {
  status: "done" | "in_progress" | "backlog";
  isCurrent: boolean;
}

export interface FileReadResult<T> {
  path: string;
  data: T | null;
  error: string | null;
}

export interface RalphUnifiedView {
  state: RalphState | null;
  prd: PRDDocument | null;
  items: UnifiedPRDItem[];
  statePath: string;
  prdPath: string | null;
  errors: {
    state: string | null;
    prd: string | null;
  };
}

const DEFAULT_STATE_PATH = path.join(".ralph", "state.json");

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeCheckpoint(value: unknown): Checkpoint | null {
  if (!isObject(value)) {
    return null;
  }

  const itemId = asNumber(value.item_id);
  const commitSha = asString(value.commit_sha);
  const timestamp = asString(value.timestamp);
  const testsPassed = asBoolean(value.tests_passed);

  if (itemId === null || commitSha === null || timestamp === null || testsPassed === null) {
    return null;
  }

  return {
    item_id: itemId,
    commit_sha: commitSha,
    timestamp,
    files_changed: asStringArray(value.files_changed),
    tests_passed: testsPassed,
    route: asString(value.route) ?? "",
  };
}

function normalizeRalphState(value: unknown): RalphState {
  if (!isObject(value)) {
    return {
      branch: null,
      prd_path: null,
      current_item: null,
      completed_items: [],
      started_at: null,
      checkpoints: [],
      agent: null,
      model: null,
      auto_push: null,
      pr_url: null,
      base_branch: null,
      current_action: null,
      action_started_at: null,
      watchdog_timeout: null,
      last_output_at: null,
      watchdog_triggered: null,
    };
  }

  const checkpoints = Array.isArray(value.checkpoints)
    ? value.checkpoints
        .map((checkpoint) => normalizeCheckpoint(checkpoint))
        .filter((checkpoint): checkpoint is Checkpoint => checkpoint !== null)
    : [];

  return {
    branch: asString(value.branch),
    prd_path: asString(value.prd_path),
    current_item: asNumber(value.current_item),
    completed_items: asNumberArray(value.completed_items),
    started_at: asString(value.started_at),
    checkpoints,
    agent: asString(value.agent),
    model: asString(value.model),
    auto_push: asBoolean(value.auto_push),
    pr_url: asString(value.pr_url),
    base_branch: asString(value.base_branch),
    current_action: asString(value.current_action),
    action_started_at: asString(value.action_started_at),
    watchdog_timeout: asNumber(value.watchdog_timeout),
    last_output_at: asString(value.last_output_at),
    watchdog_triggered: asBoolean(value.watchdog_triggered),
  };
}

function normalizePRDItem(value: unknown): PRDItem | null {
  if (!isObject(value)) {
    return null;
  }

  const id = asNumber(value.id);
  const category = asString(value.category);
  const title = asString(value.title);
  const description = asString(value.description);
  const priority = asNumber(value.priority);
  const passes = asBoolean(value.passes);
  const verification = asString(value.verification);

  if (
    id === null ||
    category === null ||
    title === null ||
    description === null ||
    priority === null ||
    passes === null ||
    verification === null
  ) {
    return null;
  }

  return {
    id,
    category,
    title,
    description,
    priority,
    passes,
    verification,
    steps: asStringArray(value.steps),
    notes: asString(value.notes) ?? "",
  };
}

function normalizePRDDocument(value: unknown): PRDDocument {
  if (!isObject(value)) {
    return {
      project: null,
      goal: null,
      items: [],
    };
  }

  const items = Array.isArray(value.items)
    ? value.items.map((item) => normalizePRDItem(item)).filter((item): item is PRDItem => item !== null)
    : [];

  return {
    project: asString(value.project),
    goal: asString(value.goal),
    items,
  };
}

async function readJsonFile(filePath: string): Promise<FileReadResult<unknown>> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return {
      path: filePath,
      data: parsed,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return {
      path: filePath,
      data: null,
      error: message,
    };
  }
}

async function resolvePRDPath(projectPath: string, preferredPath?: string | null): Promise<string | null> {
  if (preferredPath) {
    return path.isAbsolute(preferredPath) ? preferredPath : path.join(projectPath, preferredPath);
  }

  const prdJsonPath = path.join(projectPath, "prd.json");

  try {
    await fs.access(prdJsonPath);
    return prdJsonPath;
  } catch {
    // Continue to fallback discovery below.
  }

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isFile() && /^prd.*\.json$/i.test(entry.name))
      .map((entry) => path.join(projectPath, entry.name))
      .sort((a, b) => a.localeCompare(b));

    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

export async function readRalphState(projectPath: string): Promise<FileReadResult<RalphState>> {
  const statePath = path.join(projectPath, DEFAULT_STATE_PATH);
  const read = await readJsonFile(statePath);

  if (read.data === null) {
    return {
      path: statePath,
      data: null,
      error: read.error,
    };
  }

  return {
    path: statePath,
    data: normalizeRalphState(read.data),
    error: null,
  };
}

export async function readPRD(
  projectPath: string,
  preferredPath?: string | null,
): Promise<FileReadResult<PRDDocument>> {
  const resolvedPath = await resolvePRDPath(projectPath, preferredPath);

  if (!resolvedPath) {
    return {
      path: path.join(projectPath, "prd.json"),
      data: null,
      error: "Unable to locate PRD file",
    };
  }

  const read = await readJsonFile(resolvedPath);

  if (read.data === null) {
    return {
      path: resolvedPath,
      data: null,
      error: read.error,
    };
  }

  return {
    path: resolvedPath,
    data: normalizePRDDocument(read.data),
    error: null,
  };
}

function buildUnifiedItems(prdItems: PRDItem[], state: RalphState | null): UnifiedPRDItem[] {
  const completedItems = new Set(state?.completed_items ?? []);
  const currentItem = state?.current_item ?? null;

  return prdItems.map((item) => {
    const isCurrent = currentItem === item.id;
    const isDone = completedItems.has(item.id) || item.passes;

    return {
      ...item,
      isCurrent,
      status: isDone ? "done" : isCurrent ? "in_progress" : "backlog",
    };
  });
}

export async function getRalphUnifiedView(projectPath: string): Promise<RalphUnifiedView> {
  const stateResult = await readRalphState(projectPath);
  const prdResult = await readPRD(projectPath, stateResult.data?.prd_path ?? null);

  const unifiedItems = buildUnifiedItems(prdResult.data?.items ?? [], stateResult.data);

  return {
    state: stateResult.data,
    prd: prdResult.data,
    items: unifiedItems,
    statePath: stateResult.path,
    prdPath: prdResult.path,
    errors: {
      state: stateResult.error,
      prd: prdResult.error,
    },
  };
}
