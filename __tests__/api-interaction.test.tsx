import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

function ApiInteractionHarness() {
  const [message, setMessage] = React.useState("Idle");

  const handleCheck = async () => {
    const response = await fetch("/api/health");
    const payload = (await response.json()) as { service?: string };
    setMessage(payload.service ?? "Unknown");
  };

  return (
    <div>
      <button type="button" onClick={handleCheck}>
        Check API
      </button>
      <p>{message}</p>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mocked API interaction", () => {
  it("calls /api/health when user clicks and renders response data", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ service: "ralph-dashboard" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ApiInteractionHarness />);

    await user.click(screen.getByRole("button", { name: "Check API" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/health");

    await waitFor(() => {
      expect(screen.getByText("ralph-dashboard")).toBeInTheDocument();
    });
  });
});
