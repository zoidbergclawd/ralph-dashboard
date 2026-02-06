import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { GET, POST } from "../app/api/prd/route";

const createdDirs: string[] = [];
const createdFiles: string[] = [];

async function makeProjectFixture(withPrd = true): Promise<string> {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "api-prd-test-"));
  createdDirs.push(projectDir);

  if (withPrd) {
    await fs.writeFile(
      path.join(projectDir, "prd.json"),
      JSON.stringify(
        {
          project: "Ralph Mission Control",
          goal: "Upgrade the dashboard",
          items: [
            {
              id: 2,
              category: "backend",
              title: "PRD Management API",
              description: "Read and write PRD",
              priority: 1,
              passes: false,
              verification: "Unit tests for /api/prd pass",
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
  }

  return projectDir;
}

function makePrdRequest(projectPath?: string, init?: RequestInit): Request {
  const url = new URL("http://localhost/api/prd");
  if (projectPath) {
    url.searchParams.set("projectPath", projectPath);
  }

  return new Request(url, init);
}

afterEach(async () => {
  delete process.env.RALPH_PROJECT_PATH;

  await Promise.all(createdFiles.splice(0).map((filePath) => fs.rm(filePath, { force: true })));
  await Promise.all(createdDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true })));
});

describe("GET /api/prd", () => {
  it("returns the PRD document", async () => {
    const projectDir = await makeProjectFixture();

    const response = await GET(makePrdRequest(projectDir));
    const body = (await response.json()) as { prd: { project: string } };

    expect(response.status).toBe(200);
    expect(body.prd.project).toBe("Ralph Mission Control");
  });
});

describe("POST /api/prd", () => {
  it("writes the PRD document to prd.json", async () => {
    const projectDir = await makeProjectFixture(false);

    const payload = {
      project: "Ralph Mission Control",
      goal: "Upgrade the dashboard",
      items: [
        {
          id: 2,
          category: "backend",
          title: "PRD Management API",
          description: "Read and write PRD",
          priority: 1,
          passes: false,
          verification: "Unit tests for /api/prd pass",
          steps: ["Create endpoint"],
          notes: "",
        },
      ],
    };

    const response = await POST(
      makePrdRequest(projectDir, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    const body = (await response.json()) as { ok: boolean; path: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.path).toBe(path.join(projectDir, "prd.json"));

    const saved = JSON.parse(await fs.readFile(path.join(projectDir, "prd.json"), "utf8")) as {
      project: string;
    };
    expect(saved.project).toBe("Ralph Mission Control");
  });
});
