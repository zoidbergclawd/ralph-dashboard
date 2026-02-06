// @vitest-environment node

import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";

import { ProcessManager } from "@/lib/process-manager";
import {
  TERMINAL_CONNECTED_EVENT,
  TERMINAL_OUTPUT_EVENT,
  TerminalSocketServer,
} from "@/lib/terminal-socket-server";

const SOCKET_TEST_PATH = "/socket-test";

async function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 2000);

    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function waitForCondition(check: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 2000;

  while (!check()) {
    if (Date.now() >= timeoutAt) {
      throw new Error("Condition was not met before timeout");
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

class MockChildProcess extends EventEmitter {
  pid = 2222;
  kill = () => true;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe("TerminalSocketServer", () => {
  let server: TerminalSocketServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("accepts client connections and streams terminal output", async () => {
    server = new TerminalSocketServer();
    const config = await server.ensureStarted({ host: "127.0.0.1", port: 0, path: SOCKET_TEST_PATH });

    const client = createClient(`http://${config.host}:${config.port}`, {
      path: config.path,
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    try {
      await waitForEvent(client, TERMINAL_CONNECTED_EVENT);
      expect(server.getConnectedClientCount()).toBe(1);

      const outputPromise = waitForEvent<{
        pid: number;
        stream: "stdout" | "stderr";
        message: string;
      }>(client, TERMINAL_OUTPUT_EVENT);

      server.broadcastTerminalOutput({
        pid: 999,
        stream: "stdout",
        message: "running task\n",
        timestamp: new Date().toISOString(),
      });

      await expect(outputPromise).resolves.toEqual(
        expect.objectContaining({
          pid: 999,
          stream: "stdout",
          message: "running task\n",
        }),
      );
    } finally {
      client.disconnect();
    }

    await waitForCondition(() => server?.getConnectedClientCount() === 0);
  });

  it("streams stdout emitted by a running process to connected clients", async () => {
    server = new TerminalSocketServer();
    const config = await server.ensureStarted({ host: "127.0.0.1", port: 0, path: SOCKET_TEST_PATH });
    const child = new MockChildProcess();
    const manager = new ProcessManager(() => child as never, (event) => {
      server?.broadcastTerminalOutput(event);
    });

    const client = createClient(`http://${config.host}:${config.port}`, {
      path: config.path,
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    try {
      await waitForEvent(client, TERMINAL_CONNECTED_EVENT);
      const outputPromise = waitForEvent<{ pid: number; stream: "stdout" | "stderr"; message: string }>(client, TERMINAL_OUTPUT_EVENT);

      manager.startRalph({ cwd: "/tmp/project" });
      child.stdout.emit("data", "step 1 complete\\n");

      await expect(outputPromise).resolves.toEqual(
        expect.objectContaining({
          pid: 2222,
          stream: "stdout",
          message: "step 1 complete\\n",
        }),
      );
    } finally {
      client.disconnect();
    }
  });
});
