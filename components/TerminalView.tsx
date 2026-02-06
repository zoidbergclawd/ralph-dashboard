"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const TERMINAL_OUTPUT_EVENT = "terminal:output";
const DEFAULT_SOCKET_PORT = 3210;
const DEFAULT_SOCKET_PATH = "/socket.io";

interface TerminalOutputPayload {
  pid: number;
  stream: "stdout" | "stderr";
  message: string;
  timestamp: string;
}

export interface TerminalSocketConfig {
  host: string;
  port: number;
  path: string;
}

interface TerminalViewProps {
  socketConfig?: TerminalSocketConfig;
}

function buildSocketTarget(config?: TerminalSocketConfig): { url: string; path: string } | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (config) {
    return {
      url: `http://${config.host}:${config.port}`,
      path: config.path,
    };
  }

  return {
    url: `http://${window.location.hostname}:${DEFAULT_SOCKET_PORT}`,
    path: DEFAULT_SOCKET_PATH,
  };
}

function formatTerminalLine(payload: TerminalOutputPayload): string {
  const message = payload.message.replace(/\r/g, "").replace(/\n$/, "");
  return `[${payload.stream}] ${message}`;
}

export default function TerminalView({ socketConfig }: TerminalViewProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const socketTarget = useMemo(() => buildSocketTarget(socketConfig), [socketConfig]);

  useEffect(() => {
    if (!socketTarget) {
      return;
    }

    const socket: Socket = io(socketTarget.url, {
      path: socketTarget.path,
      transports: ["websocket"],
      reconnection: true,
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on(TERMINAL_OUTPUT_EVENT, (payload: TerminalOutputPayload) => {
      setLines((previous) => [...previous, formatTerminalLine(payload)]);
    });

    return () => {
      socket.disconnect();
    };
  }, [socketTarget]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [lines]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground md:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Terminal</h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{connected ? "Connected" : "Disconnected"}</p>
          <button
            type="button"
            onClick={() => setLines([])}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            disabled={lines.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        data-testid="terminal-log-container"
        role="log"
        className="mt-3 h-56 overflow-y-auto rounded-md border border-border/80 bg-black/70 p-3 font-mono text-xs leading-5 text-green-200"
      >
        {lines.length > 0 ? (
          lines.map((line, index) => (
            <p key={`${line}-${index}`} className="whitespace-pre-wrap break-words">
              {line}
            </p>
          ))
        ) : (
          <p className="text-green-100/70">Waiting for Ralph output...</p>
        )}
      </div>
    </section>
  );
}
