import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCoverageJson, parseLcovInfo, readCoverageReport } from "../lib/coverage-reader";

const tempDirs: string[] = [];

async function makeProjectDir(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "coverage-reader-test-"));
  tempDirs.push(projectDir);
  return projectDir;
}

async function writeFile(projectDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("parseCoverageJson", () => {
  it("parses Istanbul/Vitest coverage JSON and returns overall + per-file percentages", () => {
    const input = JSON.stringify(
      {
        "src/a.ts": {
          path: "src/a.ts",
          statementMap: {
            "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } },
            "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 12 } },
          },
          s: { "0": 1, "1": 0 },
        },
        "src/b.ts": {
          path: "src/b.ts",
          statementMap: {
            "0": { start: { line: 10, column: 0 }, end: { line: 10, column: 12 } },
            "1": { start: { line: 11, column: 0 }, end: { line: 11, column: 12 } },
            "2": { start: { line: 12, column: 0 }, end: { line: 12, column: 12 } },
          },
          s: { "0": 1, "1": 1, "2": 0 },
        },
      },
      null,
      2,
    );

    const result = parseCoverageJson(input);

    expect(result.overallPercentage).toBe(60);
    expect(result.perFilePercentages).toEqual({
      "src/a.ts": 50,
      "src/b.ts": 66.67,
    });
  });

  it("throws when JSON report does not contain valid coverage data", () => {
    expect(() => parseCoverageJson(JSON.stringify({ foo: "bar" }))).toThrow(
      "Coverage JSON did not include any valid file coverage data",
    );
  });
});

describe("parseLcovInfo", () => {
  it("parses LCOV data and returns overall + per-file percentages", () => {
    const input = [
      "TN:",
      "SF:src/a.ts",
      "DA:1,1",
      "DA:2,0",
      "LF:2",
      "LH:1",
      "end_of_record",
      "SF:src/b.ts",
      "DA:10,1",
      "DA:11,1",
      "end_of_record",
      "",
    ].join("\n");

    const result = parseLcovInfo(input);

    expect(result.overallPercentage).toBe(75);
    expect(result.perFilePercentages).toEqual({
      "src/a.ts": 50,
      "src/b.ts": 100,
    });
  });

  it("throws when LCOV does not contain valid file data", () => {
    expect(() => parseLcovInfo("TN:\n")).toThrow("LCOV report did not include any valid file coverage data");
  });
});

describe("readCoverageReport", () => {
  it("prefers coverage.json when present", async () => {
    const projectDir = await makeProjectDir();

    await writeFile(
      projectDir,
      "coverage/coverage.json",
      JSON.stringify(
        {
          "src/file.ts": {
            path: "src/file.ts",
            statementMap: {
              "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } },
            },
            s: { "0": 1 },
          },
        },
        null,
        2,
      ),
    );

    const result = await readCoverageReport(projectDir);

    expect(result.available).toBe(true);
    expect(result.error).toBeNull();
    expect(result.format).toBe("coverage.json");
    expect(result.overallPercentage).toBe(100);
    expect(result.perFilePercentages).toEqual({ "src/file.ts": 100 });
  });

  it("reads lcov.info when JSON report is missing", async () => {
    const projectDir = await makeProjectDir();

    await writeFile(projectDir, "coverage/lcov.info", ["SF:src/a.ts", "DA:1,1", "DA:2,0", "end_of_record", ""].join("\n"));

    const result = await readCoverageReport(projectDir);

    expect(result.available).toBe(true);
    expect(result.error).toBeNull();
    expect(result.format).toBe("lcov.info");
    expect(result.overallPercentage).toBe(50);
    expect(result.perFilePercentages).toEqual({ "src/a.ts": 50 });
  });

  it("returns not-found result when no coverage files exist", async () => {
    const projectDir = await makeProjectDir();

    const result = await readCoverageReport(projectDir);

    expect(result.available).toBe(false);
    expect(result.format).toBeNull();
    expect(result.sourcePath).toBeNull();
    expect(result.overallPercentage).toBe(0);
    expect(result.perFilePercentages).toEqual({});
    expect(result.error).toBe("Coverage report not found");
  });
});
