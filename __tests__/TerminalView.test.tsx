import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TerminalView from "@/components/TerminalView";

type Listener = (...args: unknown[]) => void;

class MockSocket {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener) {
    const current = this.listeners.get(event) ?? new Set<Listener>();
    current.add(listener);
    this.listeners.set(event, current);
  }

  disconnect() {
    this.listeners.clear();
  }

  emit(event: string, payload?: unknown) {
    const current = this.listeners.get(event);
    if (!current) {
      return;
    }

    for (const listener of current) {
      listener(payload);
    }
  }
}

const mockState = vi.hoisted(() => {
  const sockets: MockSocket[] = [];
  const ioMock = vi.fn((_url: string, _options: unknown) => {
    const socket = new MockSocket();
    sockets.push(socket);
    return socket;
  });

  return { sockets, ioMock };
});

vi.mock("socket.io-client", () => ({
  io: mockState.ioMock,
}));

afterEach(() => {
  cleanup();
  mockState.sockets.splice(0, mockState.sockets.length);
  mockState.ioMock.mockReset();
});

describe("TerminalView", () => {
  it("connects to the socket and renders streamed log lines", async () => {
    render(<TerminalView socketConfig={{ host: "127.0.0.1", port: 3456, path: "/socket.io" }} />);

    expect(mockState.ioMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3456",
      expect.objectContaining({ path: "/socket.io", transports: ["websocket"] }),
    );

    const socket = mockState.sockets[0];
    socket.emit("terminal:output", {
      pid: 100,
      stream: "stdout",
      message: "step completed\n",
      timestamp: new Date().toISOString(),
    });

    expect(await screen.findByText("[stdout] step completed")).toBeInTheDocument();
  });

  it("auto-scrolls when new logs arrive", async () => {
    render(<TerminalView />);

    const container = screen.getByTestId("terminal-log-container");
    Object.defineProperty(container, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(container, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });

    const socket = mockState.sockets[0];
    socket.emit("terminal:output", {
      pid: 200,
      stream: "stderr",
      message: "error line\n",
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      expect((container as HTMLDivElement).scrollTop).toBe(500);
    });
  });

  it("clears the visible logs", async () => {
    render(<TerminalView />);

    const socket = mockState.sockets[0];
    socket.emit("terminal:output", {
      pid: 300,
      stream: "stdout",
      message: "hello\n",
      timestamp: new Date().toISOString(),
    });

    expect(await screen.findByText("[stdout] hello")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(screen.queryByText("[stdout] hello")).not.toBeInTheDocument();
      expect(screen.getByText("Waiting for Ralph output...")).toBeInTheDocument();
    });
  });
});
