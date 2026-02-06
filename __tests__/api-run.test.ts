import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

const startRalphMock = vi.fn();

vi.mock("@/lib/process-manager", () => {
  class ProcessManagerError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = "ProcessManagerError";
      this.code = code;
    }
  }

  return {
    ProcessManagerError,
    processManager: {
      startRalph: startRalphMock,
      stopProcess: vi.fn(),
      resumeRalph: vi.fn(),
    },
  };
});

const createdDirs: string[] = [];

async function makeProjectFixture(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-run-test-"));
  createdDirs.push(projectDir);
  return projectDir;
}

afterEach(async () => {
  startRalphMock.mockReset();
  delete process.env.RALPH_PROJECT_PATH;

  await Promise.all(createdDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true })));
});

describe("POST /api/run/start", () => {
  it("spawns a mocked process and returns the PID", async () => {
    const projectDir = await makeProjectFixture();
    startRalphMock.mockReturnValue({
      pid: 2468,
      command: "ralph",
      args: ["start", "prd.json", "--team", "alpha"],
      cwd: projectDir,
      startedAt: "2026-01-01T00:00:00.000Z",
      status: "running",
    });

    const { POST } = await import("../app/api/run/start/route");

    const url = new URL("http://localhost/api/run/start");
    url.searchParams.set("projectPath", projectDir);

    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: ["--team", "alpha"] }),
      }),
    );

    const body = (await response.json()) as {
      ok: boolean;
      process: { pid: number; args: string[]; cwd: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.process.pid).toBe(2468);
    expect(body.process.args).toEqual(["start", "prd.json", "--team", "alpha"]);
    expect(body.process.cwd).toBe(projectDir);

    expect(startRalphMock).toHaveBeenCalledWith({
      cwd: projectDir,
      prdPath: undefined,
      flags: ["--team", "alpha"],
    });
  });
});
