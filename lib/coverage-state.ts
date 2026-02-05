import { readFile } from "node:fs/promises";
import path from "node:path";

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface CoverageSummaryTotal {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

export interface CoverageState {
  available: boolean;
  summaryPath: string | null;
  total: CoverageSummaryTotal | null;
  error: string | null;
}

const COVERAGE_SUMMARY_CANDIDATES = [
  path.join("coverage", "coverage-summary.json"),
  path.join(".coverage", "coverage-summary.json"),
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMetric(value: unknown): CoverageMetric | null {
  if (!isObject(value)) {
    return null;
  }

  const total = typeof value.total === "number" ? value.total : null;
  const covered = typeof value.covered === "number" ? value.covered : null;
  const skipped = typeof value.skipped === "number" ? value.skipped : 0;
  const pct = typeof value.pct === "number" ? value.pct : null;

  if (total === null || covered === null || pct === null) {
    return null;
  }

  return {
    total,
    covered,
    skipped,
    pct,
  };
}

function normalizeCoverageTotal(value: unknown): CoverageSummaryTotal | null {
  if (!isObject(value)) {
    return null;
  }

  const lines = normalizeMetric(value.lines);
  const statements = normalizeMetric(value.statements);
  const functions = normalizeMetric(value.functions);
  const branches = normalizeMetric(value.branches);

  if (!lines || !statements || !functions || !branches) {
    return null;
  }

  return {
    lines,
    statements,
    functions,
    branches,
  };
}

export async function readCoverageState(projectPath: string): Promise<CoverageState> {
  for (const relativePath of COVERAGE_SUMMARY_CANDIDATES) {
    const absolutePath = path.join(projectPath, relativePath);

    try {
      const raw = await readFile(absolutePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const total = isObject(parsed) ? normalizeCoverageTotal(parsed.total) : null;

      if (!total) {
        return {
          available: false,
          summaryPath: absolutePath,
          total: null,
          error: "Coverage summary file format is invalid",
        };
      }

      return {
        available: true,
        summaryPath: absolutePath,
        total,
        error: null,
      };
    } catch {
      // Try the next candidate path.
    }
  }

  return {
    available: false,
    summaryPath: null,
    total: null,
    error: "Coverage summary file not found",
  };
}
