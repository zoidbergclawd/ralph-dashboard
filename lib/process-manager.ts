import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

import { terminalSocketServer } from "@/lib/terminal-socket-server";

type ProcessStatus = "running" | "exited";
type ProcessErrorCode = "ALREADY_RUNNING" | "NO_ACTIVE_PROCESS" | "PID_MISMATCH" | "SPAWN_FAILED" | "STOP_FAILED";
export type ProcessOutputStream = "stdout" | "stderr";

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  startedAt: string;
  status: ProcessStatus;
}

export interface StartProcessOptions {
  command: string;
  args?: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export interface StopProcessOptions {
  pid?: number;
  signal?: NodeJS.Signals | number;
}

export interface StartRalphOptions {
  cwd: string;
  prdPath?: string;
  flags?: string[];
  env?: NodeJS.ProcessEnv;
}

export interface ResumeRalphOptions {
  cwd: string;
  flags?: string[];
  env?: NodeJS.ProcessEnv;
}

export interface ProcessOutputEvent {
  pid: number;
  stream: ProcessOutputStream;
  message: string;
  timestamp: string;
}

interface ManagedProcess {
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  startedAt: string;
  child: ChildProcess;
}

type SpawnProcess = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
type ProcessOutputListener = (event: ProcessOutputEvent) => void;

export class ProcessManagerError extends Error {
  constructor(
    public readonly code: ProcessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProcessManagerError";
  }
}

export class ProcessManager {
  private activeProcess: ManagedProcess | null = null;

  constructor(
    private readonly spawnProcess: SpawnProcess = spawn,
    private readonly outputListener?: ProcessOutputListener,
  ) {}

  getActiveProcess(): ProcessInfo | null {
    if (!this.activeProcess) {
      return null;
    }

    return {
      pid: this.activeProcess.pid,
      command: this.activeProcess.command,
      args: [...this.activeProcess.args],
      cwd: this.activeProcess.cwd,
      startedAt: this.activeProcess.startedAt,
      status: "running",
    };
  }

  startProcess(options: StartProcessOptions): ProcessInfo {
    if (this.activeProcess) {
      throw new ProcessManagerError("ALREADY_RUNNING", `Process ${this.activeProcess.pid} is already running.`);
    }

    const args = options.args ?? [];
    const child = this.spawnProcess(options.command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      stdio: "pipe",
    });

    const pid = child.pid;
    if (!pid) {
      throw new ProcessManagerError("SPAWN_FAILED", "Failed to spawn process.");
    }

    const startedAt = new Date().toISOString();
    this.activeProcess = {
      pid,
      command: options.command,
      args: [...args],
      cwd: options.cwd,
      startedAt,
      child,
    };

    this.bindOutputStream(child, pid, "stdout");
    this.bindOutputStream(child, pid, "stderr");

    child.once("exit", () => {
      if (this.activeProcess?.pid === pid) {
        this.activeProcess = null;
      }
    });

    return {
      pid,
      command: options.command,
      args: [...args],
      cwd: options.cwd,
      startedAt,
      status: "running",
    };
  }

  startRalph(options: StartRalphOptions): ProcessInfo {
    const prdPath = options.prdPath ?? "prd.json";
    const flags = options.flags ?? [];

    return this.startProcess({
      command: "ralph",
      args: ["start", prdPath, ...flags],
      cwd: options.cwd,
      env: options.env,
    });
  }

  resumeRalph(options: ResumeRalphOptions): ProcessInfo {
    const flags = options.flags ?? [];

    return this.startProcess({
      command: "ralph",
      args: ["resume", ...flags],
      cwd: options.cwd,
      env: options.env,
    });
  }

  stopProcess(options: StopProcessOptions = {}): ProcessInfo {
    if (!this.activeProcess) {
      throw new ProcessManagerError("NO_ACTIVE_PROCESS", "No active process to stop.");
    }

    if (options.pid !== undefined && options.pid !== this.activeProcess.pid) {
      throw new ProcessManagerError(
        "PID_MISMATCH",
        `PID ${options.pid} does not match active process ${this.activeProcess.pid}.`,
      );
    }

    const signal = options.signal ?? "SIGTERM";
    const didSignal = this.activeProcess.child.kill(signal);

    if (!didSignal) {
      throw new ProcessManagerError("STOP_FAILED", `Failed to send ${signal} to process ${this.activeProcess.pid}.`);
    }

    return {
      pid: this.activeProcess.pid,
      command: this.activeProcess.command,
      args: [...this.activeProcess.args],
      cwd: this.activeProcess.cwd,
      startedAt: this.activeProcess.startedAt,
      status: "running",
    };
  }

  private bindOutputStream(child: ChildProcess, pid: number, stream: ProcessOutputStream): void {
    const source = stream === "stdout" ? child.stdout : child.stderr;
    if (!source) {
      return;
    }

    source.on("data", (chunk) => {
      const message = this.normalizeOutputChunk(chunk);
      if (message.length === 0) {
        return;
      }

      this.outputListener?.({
        pid,
        stream,
        message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private normalizeOutputChunk(chunk: unknown): string {
    if (typeof chunk === "string") {
      return chunk;
    }

    if (Buffer.isBuffer(chunk)) {
      return chunk.toString("utf8");
    }

    return String(chunk ?? "");
  }
}

export const processManager = new ProcessManager(spawn, (event) => {
  terminalSocketServer.broadcastTerminalOutput(event);
});
