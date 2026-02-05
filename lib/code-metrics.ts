import { promises as fs } from "node:fs";
import path from "node:path";

export interface CodeMetrics {
  totalLoc: number;
  locByLanguage: Record<string, number>;
  fileCount: number;
  testFileCount: number;
  error: string | null;
}

export interface ReadCodeMetricsOptions {
  excludeDirectories?: string[];
}

const DEFAULT_EXCLUDED_DIRECTORIES = new Set([".git", "node_modules", ".next", ".ralph"]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".json": "JSON",
  ".css": "CSS",
  ".scss": "SCSS",
  ".html": "HTML",
  ".md": "Markdown",
  ".yml": "YAML",
  ".yaml": "YAML",
};

function defaultMetrics(error: string | null = null): CodeMetrics {
  return {
    totalLoc: 0,
    locByLanguage: {},
    fileCount: 0,
    testFileCount: 0,
    error,
  };
}

function countNonEmptyLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] ?? "Other";
}

function isTestFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  return (
    /(^|\/)__tests__(\/|$)/.test(normalizedPath) ||
    /\.(test|spec)\.[^./]+$/i.test(normalizedPath) ||
    /(^|\/)test[^/]*\.[^/]+$/i.test(path.basename(normalizedPath))
  );
}

async function collectFilePaths(
  rootPath: string,
  excludedDirectories: Set<string>,
  acc: string[] = [],
): Promise<string[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }

      await collectFilePaths(fullPath, excludedDirectories, acc);
      continue;
    }

    if (entry.isFile()) {
      acc.push(fullPath);
    }
  }

  return acc;
}

export async function readCodeMetrics(
  projectPath: string,
  options: ReadCodeMetricsOptions = {},
): Promise<CodeMetrics> {
  const excludedDirectories = new Set(DEFAULT_EXCLUDED_DIRECTORIES);

  for (const directory of options.excludeDirectories ?? []) {
    excludedDirectories.add(directory);
  }

  try {
    const files = await collectFilePaths(projectPath, excludedDirectories);

    const metrics = defaultMetrics();
    metrics.fileCount = files.length;

    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf8");
      const loc = countNonEmptyLines(content);
      const language = detectLanguage(filePath);

      metrics.totalLoc += loc;
      metrics.locByLanguage[language] = (metrics.locByLanguage[language] ?? 0) + loc;

      if (isTestFile(filePath)) {
        metrics.testFileCount += 1;
      }
    }

    return metrics;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown code metrics error";
    return defaultMetrics(message);
  }
}
