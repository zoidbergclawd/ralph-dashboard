import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { GET as healthGET } from "../app/api/health/route";
import { GET as stateGET } from "../app/api/state/route";

const createdDirs: string[] = [];
const createdFiles: string[] = [];

async function makeProjectFixture(): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-state-test-"));
  createdDirs.push(projectDir);

  await fs.mkdir(path.join(projectDir, ".ralph"), { recursive: true });
  await fs.writeFile(
    path.join(projectDir, ".ralph", "state.json"),
    JSON.stringify(
      {
        branch: "main",
        prd_path: "prd.json",
        current_item: 7,
        completed_items: [1, 2, 3],
        checkpoints: [],
      },
      null,
      2,
    ),
    "utf8",
  );

  await fs.writeFile(
    path.join(projectDir, "prd.json"),
    JSON.stringify(
      {
        project: "Ralph Dashboard",
        goal: "A real-time web UI for watching Ralph runs.",
        items: [
          {
            id: 7,
            category: "api",
            title: "API routes for state",
            description: "Serve unified state",
            priority: 1,
            passes: false,
            verification: "Unit tests for /api/state pass",
            steps: ["Create endpoint"],
            notes: "",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  return projectDir;
}

function makeStateRequest(projectPath?: string): Request {
  const url = new URL("http://localhost/api/state");
  if (projectPath) {
    url.searchParams.set("projectPath", projectPath);
  }

  return new Request(url);
}

afterEach(async () => {
  delete process.env.RALPH_PROJECT_PATH;

  await Promise.all(createdFiles.splice(0).map((filePath) => fs.rm(filePath, { force: true })));
  await Promise.all(createdDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true })));
});

describe("GET /api/state", () => {
  it("returns combined state using projectPath query parameter", async () => {
    const projectDir = await makeProjectFixture();

    const response = await stateGET(makeStateRequest(projectDir));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.projectPath).toBe(projectDir);
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("ralph");
    expect(body).toHaveProperty("git");
    expect(body).toHaveProperty("metrics");
    expect(body).toHaveProperty("coverage");
  });

  it("returns combined state using path query parameter alias", async () => {
    const projectDir = await makeProjectFixture();
    const url = new URL("http://localhost/api/state");
    url.searchParams.set("path", projectDir);

    const response = await stateGET(new Request(url));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.projectPath).toBe(projectDir);
  });

  it("uses RALPH_PROJECT_PATH when query param is not provided", async () => {
    const projectDir = await makeProjectFixture();
    process.env.RALPH_PROJECT_PATH = projectDir;

    const response = await stateGET(makeStateRequest());
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.projectPath).toBe(projectDir);
  });

  it("returns 400 when project path is missing from query and env", async () => {
    const response = await stateGET(makeStateRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Missing project path");
  });

  it("returns 404 when project path does not exist", async () => {
    const missingPath = path.join(os.tmpdir(), "api-state-missing", String(Date.now()));
    const response = await stateGET(makeStateRequest(missingPath));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("returns 400 when project path is not a directory", async () => {
    const tempFile = path.join(os.tmpdir(), `api-state-file-${Date.now()}.txt`);
    createdFiles.push(tempFile);
    await fs.writeFile(tempFile, "not a directory", "utf8");

    const response = await stateGET(makeStateRequest(tempFile));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("not a directory");
  });
});

describe("GET /api/health", () => {
  it("returns healthy response", async () => {
    const response = await healthGET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("ralph-dashboard");
    expect(body).toHaveProperty("timestamp");
  });
});
