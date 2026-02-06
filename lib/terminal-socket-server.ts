import { createServer, type Server as HttpServer } from "node:http";

import { Server as SocketIOServer } from "socket.io";

import type { ProcessOutputEvent } from "@/lib/process-manager";

export const TERMINAL_OUTPUT_EVENT = "terminal:output";
export const TERMINAL_CONNECTED_EVENT = "terminal:connected";

export interface TerminalSocketConfig {
  host: string;
  port: number;
  path: string;
}

interface StartOptions {
  host?: string;
  port?: number;
  path?: string;
}

const DEFAULT_HOST = process.env.RALPH_SOCKET_HOST ?? "127.0.0.1";
const DEFAULT_PORT = Number(process.env.RALPH_SOCKET_PORT ?? 3210);
const DEFAULT_PATH = process.env.RALPH_SOCKET_PATH ?? "/socket.io";
const DEFAULT_CORS_ORIGIN = process.env.RALPH_SOCKET_CORS_ORIGIN ?? "*";

export class TerminalSocketServer {
  private httpServer: HttpServer | null = null;
  private io: SocketIOServer | null = null;
  private startPromise: Promise<TerminalSocketConfig> | null = null;
  private config: TerminalSocketConfig | null = null;
  private connectedClients = 0;

  async ensureStarted(options: StartOptions = {}): Promise<TerminalSocketConfig> {
    if (this.config) {
      return this.config;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.startServer(options);

    try {
      this.config = await this.startPromise;
      return this.config;
    } finally {
      this.startPromise = null;
    }
  }

  getConfig(): TerminalSocketConfig | null {
    return this.config;
  }

  getConnectedClientCount(): number {
    return this.connectedClients;
  }

  broadcastTerminalOutput(payload: ProcessOutputEvent): void {
    this.io?.emit(TERMINAL_OUTPUT_EVENT, payload);
  }

  async stop(): Promise<void> {
    this.connectedClients = 0;
    this.config = null;

    await new Promise<void>((resolve) => {
      this.io?.close(() => resolve());
      if (!this.io) {
        resolve();
      }
    });

    this.io = null;

    await new Promise<void>((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }

      this.httpServer.close((error) => {
        if (error) {
          const code = "code" in error ? String(error.code) : "";
          if (code === "ERR_SERVER_NOT_RUNNING") {
            resolve();
            return;
          }

          reject(error);
          return;
        }

        resolve();
      });
    });

    this.httpServer = null;
  }

  private async startServer(options: StartOptions): Promise<TerminalSocketConfig> {
    const host = options.host ?? DEFAULT_HOST;
    const port = options.port ?? DEFAULT_PORT;
    const path = options.path ?? DEFAULT_PATH;

    this.httpServer = createServer();
    this.io = new SocketIOServer(this.httpServer, {
      path,
      cors: {
        origin: DEFAULT_CORS_ORIGIN,
      },
    });

    this.io.on("connection", (socket) => {
      this.connectedClients += 1;
      socket.emit(TERMINAL_CONNECTED_EVENT, {
        connectedAt: new Date().toISOString(),
      });

      socket.once("disconnect", () => {
        this.connectedClients = Math.max(0, this.connectedClients - 1);
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer?.once("error", reject);
      this.httpServer?.listen(port, host, () => resolve());
    });

    const address = this.httpServer.address();
    const resolvedPort = typeof address === "object" && address !== null ? address.port : port;

    return {
      host,
      port: resolvedPort,
      path,
    };
  }
}

export const terminalSocketServer = new TerminalSocketServer();
