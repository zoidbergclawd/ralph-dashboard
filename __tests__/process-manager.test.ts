// @vitest-environment node

import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { ProcessManager, ProcessManagerError } from "@/lib/process-manager";

class MockChildProcess extends EventEmitter {
  pid: number;
  kill = vi.fn(() => true);
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  constructor(pid: number) {
    super();
    this.pid = pid;
  }
}

describe("ProcessManager", () => {
  it("starts a Ralph run and returns a PID", () => {
    const child = new MockChildProcess(4321);
    const spawnMock = vi.fn(() => child as never);
    const manager = new ProcessManager(spawnMock);

    const result = manager.startRalph({
      cwd: "/tmp/project",
      flags: ["--team", "alpha"],
    });

    expect(result.pid).toBe(4321);
    expect(result.command).toBe("ralph");
    expect(result.args).toEqual(["start", "prd.json", "--team", "alpha"]);
    expect(result.status).toBe("running");
    expect(spawnMock).toHaveBeenCalledWith(
      "ralph",
      ["start", "prd.json", "--team", "alpha"],
      expect.objectContaining({ cwd: "/tmp/project", stdio: "pipe" }),
    );
  });

  it("prevents starting a second process while one is active", () => {
    const child = new MockChildProcess(1234);
    const manager = new ProcessManager(vi.fn(() => child as never));

    manager.startRalph({ cwd: "/tmp/project" });

    expect(() => manager.resumeRalph({ cwd: "/tmp/project" })).toThrowError(ProcessManagerError);
    expect(() => manager.resumeRalph({ cwd: "/tmp/project" })).toThrowError(/already running/i);
  });

  it("stops the active process", () => {
    const child = new MockChildProcess(3001);
    const manager = new ProcessManager(vi.fn(() => child as never));

    manager.startRalph({ cwd: "/tmp/project" });
    const stopped = manager.stopProcess();

    expect(stopped.pid).toBe(3001);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("clears active process when child exits", () => {
    const child = new MockChildProcess(7007);
    const manager = new ProcessManager(vi.fn(() => child as never));

    manager.startRalph({ cwd: "/tmp/project" });
    child.emit("exit", 0, null);

    expect(manager.getActiveProcess()).toBeNull();
  });

  it("uses resume command for resumeRalph", () => {
    const child = new MockChildProcess(5110);
    const spawnMock = vi.fn(() => child as never);
    const manager = new ProcessManager(spawnMock);

    const resumed = manager.resumeRalph({ cwd: "/tmp/project", flags: ["--team", "2"] });

    expect(resumed.pid).toBe(5110);
    expect(spawnMock).toHaveBeenCalledWith(
      "ralph",
      ["resume", "--team", "2"],
      expect.objectContaining({ cwd: "/tmp/project", stdio: "pipe" }),
    );
  });

  it("throws when stopping with a mismatched PID", () => {
    const child = new MockChildProcess(9876);
    const manager = new ProcessManager(vi.fn(() => child as never));

    manager.startRalph({ cwd: "/tmp/project" });

    expect(() => manager.stopProcess({ pid: 9877 })).toThrowError(ProcessManagerError);
    expect(() => manager.stopProcess({ pid: 9877 })).toThrowError(/does not match/i);
  });

  it("emits stdout and stderr output through the output listener", () => {
    const child = new MockChildProcess(4100);
    const outputListener = vi.fn();
    const manager = new ProcessManager(vi.fn(() => child as never), outputListener);

    manager.startRalph({ cwd: "/tmp/project" });
    child.stdout.emit("data", Buffer.from("build started\\n"));
    child.stderr.emit("data", "warning: partial failure\\n");

    expect(outputListener).toHaveBeenCalledTimes(2);
    expect(outputListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pid: 4100,
        stream: "stdout",
        message: "build started\\n",
      }),
    );
    expect(outputListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pid: 4100,
        stream: "stderr",
        message: "warning: partial failure\\n",
      }),
    );
  });
});
