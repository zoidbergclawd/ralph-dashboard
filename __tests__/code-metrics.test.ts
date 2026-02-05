import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readCodeMetrics } from "../lib/code-metrics";

const tempDirs: string[] = [];

async function makeProjectDir(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-metrics-test-"));
  tempDirs.push(projectDir);
  return projectDir;
}

async function writeFile(relativePath: string, content: string, projectDir: string): Promise<void> {
  const fullPath = path.join(projectDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("readCodeMetrics", () => {
  it("calculates LOC, language breakdown, file count, and test file count", async () => {
    const projectDir = await makeProjectDir();

    await writeFile(
      "src/index.ts",
      [
        "import { sum } from './sum';",
        "",
        "export function run() {",
        "  return sum(1, 2);",
        "}",
        "",
      ].join("\n"),
      projectDir,
    );

    await writeFile(
      "src/sum.js",
      ["export const sum = (a, b) => {", "  return a + b;", "};", ""].join("\n"),
      projectDir,
    );

    await writeFile("README.md", ["# Ralph Dashboard", "", "watch the magic happen", ""].join("\n"), projectDir);

    await writeFile("src/sum.test.ts", ["import { sum } from './sum';", "", "test('sum', () => {", "});"].join("\n"), projectDir);

    await writeFile(
      "__tests__/integration.spec.ts",
      ["describe('integration', () => {", "  it('runs', () => {", "  });", "});"].join("\n"),
      projectDir,
    );

    const metrics = await readCodeMetrics(projectDir);

    expect(metrics.error).toBeNull();
    expect(metrics.fileCount).toBe(5);
    expect(metrics.testFileCount).toBe(2);
    expect(metrics.totalLoc).toBe(16);
    expect(metrics.locByLanguage).toEqual({
      TypeScript: 11,
      JavaScript: 3,
      Markdown: 2,
    });
  });

  it("ignores default excluded directories", async () => {
    const projectDir = await makeProjectDir();

    await writeFile("src/app.ts", "export const app = true;", projectDir);
    await writeFile("node_modules/pkg/index.js", "line1\nline2", projectDir);
    await writeFile(".next/cache.js", "line1\nline2", projectDir);
    await writeFile(".git/HEAD", "ref: refs/heads/main", projectDir);

    const metrics = await readCodeMetrics(projectDir);

    expect(metrics.error).toBeNull();
    expect(metrics.fileCount).toBe(1);
    expect(metrics.totalLoc).toBe(1);
    expect(metrics.locByLanguage).toEqual({
      TypeScript: 1,
    });
  });

  it("returns default metrics with error when path does not exist", async () => {
    const missingPath = path.join(os.tmpdir(), "missing-code-metrics-path", String(Date.now()));

    const metrics = await readCodeMetrics(missingPath);

    expect(metrics.totalLoc).toBe(0);
    expect(metrics.fileCount).toBe(0);
    expect(metrics.testFileCount).toBe(0);
    expect(metrics.locByLanguage).toEqual({});
    expect(metrics.error).toBeTruthy();
  });
});
