import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

function HealthCheckButton(): JSX.Element {
  const [status, setStatus] = React.useState("idle");

  const handleClick = async () => {
    setStatus("loading");
    const response = await fetch("/api/health");
    const data = (await response.json()) as { ok: boolean };
    setStatus(data.ok ? "ok" : "error");
  };

  return (
    <div>
      <button type="button" onClick={handleClick}>
        Check health
      </button>
      <span>{status}</span>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mocked API interaction", () => {
  it("calls /api/health and updates UI", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<HealthCheckButton />);

    await user.click(screen.getByRole("button", { name: "Check health" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/health");
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });
});
