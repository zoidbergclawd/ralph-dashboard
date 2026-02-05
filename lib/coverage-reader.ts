import { readFile } from "node:fs/promises";
import path from "node:path";

export interface CoverageParseOutput {
  overallPercentage: number;
  perFilePercentages: Record<string, number>;
}

export interface CoverageReaderResult extends CoverageParseOutput {
  available: boolean;
  format: "coverage.json" | "lcov.info" | null;
  sourcePath: string | null;
  error: string | null;
}

const COVERAGE_REPORT_CANDIDATES: Array<{ relativePath: string; format: "coverage.json" | "lcov.info" }> = [
  { relativePath: path.join("coverage", "coverage.json"), format: "coverage.json" },
  { relativePath: path.join("coverage", "coverage-final.json"), format: "coverage.json" },
  { relativePath: path.join("coverage", "lcov.info"), format: "lcov.info" },
  { relativePath: "lcov.info", format: "lcov.info" },
];

interface CoverageCount {
  covered: number;
  total: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toPercentage(covered: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Number(((covered / total) * 100).toFixed(2));
}

function parseCoverageSummaryEntry(entry: unknown): CoverageCount | null {
  if (!isObject(entry) || !isObject(entry.lines)) {
    return null;
  }

  const total = typeof entry.lines.total === "number" ? entry.lines.total : null;
  const covered = typeof entry.lines.covered === "number" ? entry.lines.covered : null;

  if (total === null || covered === null || total < 0 || covered < 0) {
    return null;
  }

  return { covered, total };
}

function parseIstanbulFileEntry(entry: unknown): CoverageCount | null {
  if (!isObject(entry) || !isObject(entry.s) || !isObject(entry.statementMap)) {
    return null;
  }

  const coveredLines = new Set<number>();
  const totalLines = new Set<number>();

  for (const [statementId, countValue] of Object.entries(entry.s)) {
    const statement = entry.statementMap[statementId];

    if (!isObject(statement) || !isObject(statement.start)) {
      continue;
    }

    const line = typeof statement.start.line === "number" ? statement.start.line : null;
    const count = typeof countValue === "number" ? countValue : null;

    if (line === null || count === null) {
      continue;
    }

    totalLines.add(line);

    if (count > 0) {
      coveredLines.add(line);
    }
  }

  return {
    covered: coveredLines.size,
    total: totalLines.size,
  };
}

function parseCoverageJsonObject(value: unknown): CoverageParseOutput {
  if (!isObject(value)) {
    throw new Error("Coverage JSON must be an object");
  }

  const perFilePercentages: Record<string, number> = {};
  let coveredTotal = 0;
  let lineTotal = 0;

  for (const [filePath, entry] of Object.entries(value)) {
    if (filePath === "total") {
      continue;
    }

    const coverage = parseCoverageSummaryEntry(entry) ?? parseIstanbulFileEntry(entry);

    if (!coverage || coverage.total <= 0) {
      continue;
    }

    perFilePercentages[filePath] = toPercentage(coverage.covered, coverage.total);
    coveredTotal += coverage.covered;
    lineTotal += coverage.total;
  }

  if (lineTotal === 0) {
    const totalSummary = parseCoverageSummaryEntry(value.total);

    if (totalSummary && totalSummary.total > 0) {
      return {
        overallPercentage: toPercentage(totalSummary.covered, totalSummary.total),
        perFilePercentages,
      };
    }

    throw new Error("Coverage JSON did not include any valid file coverage data");
  }

  return {
    overallPercentage: toPercentage(coveredTotal, lineTotal),
    perFilePercentages,
  };
}

export function parseCoverageJson(raw: string): CoverageParseOutput {
  const parsed = JSON.parse(raw) as unknown;
  return parseCoverageJsonObject(parsed);
}

export function parseLcovInfo(raw: string): CoverageParseOutput {
  const perFilePercentages: Record<string, number> = {};

  let currentFile: string | null = null;
  let hasLh = false;
  let hasLf = false;
  let lh = 0;
  let lf = 0;
  let daLineHits = new Map<number, number>();

  let coveredTotal = 0;
  let lineTotal = 0;

  function finalizeCurrentFile(): void {
    if (!currentFile) {
      return;
    }

    let covered = 0;
    let total = 0;

    if (hasLf && hasLh) {
      covered = lh;
      total = lf;
    } else {
      total = daLineHits.size;

      for (const hits of daLineHits.values()) {
        if (hits > 0) {
          covered += 1;
        }
      }
    }

    if (total > 0) {
      perFilePercentages[currentFile] = toPercentage(covered, total);
      coveredTotal += covered;
      lineTotal += total;
    }

    currentFile = null;
    hasLh = false;
    hasLf = false;
    lh = 0;
    lf = 0;
    daLineHits = new Map<number, number>();
  }

  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (line.startsWith("SF:")) {
      finalizeCurrentFile();
      currentFile = line.slice(3).trim();
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("DA:")) {
      const payload = line.slice(3);
      const [lineNumberRaw, hitsRaw] = payload.split(",", 2);
      const lineNumber = Number.parseInt(lineNumberRaw ?? "", 10);
      const hits = Number.parseInt(hitsRaw ?? "", 10);

      if (!Number.isNaN(lineNumber) && !Number.isNaN(hits)) {
        const previous = daLineHits.get(lineNumber) ?? 0;
        daLineHits.set(lineNumber, Math.max(previous, hits));
      }

      continue;
    }

    if (line.startsWith("LH:")) {
      const value = Number.parseInt(line.slice(3).trim(), 10);

      if (!Number.isNaN(value)) {
        hasLh = true;
        lh = value;
      }

      continue;
    }

    if (line.startsWith("LF:")) {
      const value = Number.parseInt(line.slice(3).trim(), 10);

      if (!Number.isNaN(value)) {
        hasLf = true;
        lf = value;
      }

      continue;
    }

    if (line === "end_of_record") {
      finalizeCurrentFile();
    }
  }

  finalizeCurrentFile();

  if (lineTotal === 0) {
    throw new Error("LCOV report did not include any valid file coverage data");
  }

  return {
    overallPercentage: toPercentage(coveredTotal, lineTotal),
    perFilePercentages,
  };
}

export async function readCoverageReport(projectPath: string): Promise<CoverageReaderResult> {
  for (const candidate of COVERAGE_REPORT_CANDIDATES) {
    const absolutePath = path.join(projectPath, candidate.relativePath);

    try {
      const raw = await readFile(absolutePath, "utf8");
      const parsed = candidate.format === "coverage.json" ? parseCoverageJson(raw) : parseLcovInfo(raw);

      return {
        available: true,
        format: candidate.format,
        sourcePath: absolutePath,
        overallPercentage: parsed.overallPercentage,
        perFilePercentages: parsed.perFilePercentages,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("ENOENT")) {
        continue;
      }

      return {
        available: false,
        format: candidate.format,
        sourcePath: absolutePath,
        overallPercentage: 0,
        perFilePercentages: {},
        error: message,
      };
    }
  }

  return {
    available: false,
    format: null,
    sourcePath: null,
    overallPercentage: 0,
    perFilePercentages: {},
    error: "Coverage report not found",
  };
}
