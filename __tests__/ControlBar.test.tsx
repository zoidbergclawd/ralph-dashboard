import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ControlBar from "@/components/ControlBar";

function okResponse(): Response {
  return {
    ok: true,
    json: async () => ({ ok: true }),
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ControlBar", () => {
  it("triggers start API call with selected agent and team size, then shows running status", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ControlBar projectPath="/tmp/project" initialStatus="stopped" />);

    await user.selectOptions(screen.getByLabelText("Agent"), "claude");
    await user.selectOptions(screen.getByLabelText("Team Size"), "4");
    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/run/start?projectPath=%2Ftmp%2Fproject");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");

    const body = JSON.parse(String(init.body)) as { projectPath: string; flags: string[] };
    expect(body.projectPath).toBe("/tmp/project");
    expect(body.flags).toEqual(["--agent", "claude", "--team", "4"]);

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("triggers stop API call and updates status to stopped", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ControlBar projectPath="/tmp/project" initialStatus="running" />);

    expect(screen.getByText("Running")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/run/stop", expect.objectContaining({ method: "POST" }));
    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  it("triggers resume API call with selected flags", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ControlBar projectPath="/tmp/project" initialStatus="stopped" />);

    await user.selectOptions(screen.getByLabelText("Agent"), "codex");
    await user.selectOptions(screen.getByLabelText("Team Size"), "3");
    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/run/resume?projectPath=%2Ftmp%2Fproject");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { flags: string[] };
    expect(body.flags).toEqual(["--agent", "codex", "--team", "3"]);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });
});
